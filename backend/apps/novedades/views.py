import json
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.utils import timezone
from django.db.models import Count
from django.db.models import Count, Q
from apps.novedades.models import Novedades, MotivoNegativo, MotivoPositivo, NovedadEvento, NovedadEvidencia, HorarioLaboral
from apps.novedades.horario_laboral import calcular_sla_novedad, calcular_espera_dd, horas_habiles_entre
from apps.Vehiculo.models import Ruta
from apps.Informes.models import CategoriaTipoInforme, Informe
from apps.novedades.forms_schema import NOVEDADES_FORM
from apps.usuarios_colfenix.models import UsuariosColfenix
from apps.configuracion.permisos import tiene_permiso


def _no_autenticado():
    return JsonResponse({"success": False, "mensaje": "Debes iniciar sesión."}, status=401)


def _sin_permiso():
    return JsonResponse({"success": False, "mensaje": "No tienes permisos para esta acción."}, status=403)


def _novedades_queryset():
    return Novedades.objects.select_related(
        'cliente',
        'vehiculo',
        'grupo_flota',
        'area_solicitante',
        'tipo_informe',
        'tipo_informe__categoria_informe',
        'ruta',
        'analista',
        'motivo_negativo',
        'motivo_positivo',
    )


# Orden real de las etapas de estado_dd, y qué campo de fecha marca la
# entrada a cada una. Se usa tanto al crear una novedad directo en un estado
# avanzado (CrearNovedad) como al transicionarla (NovedadDetalleView) —
# antes estos 3 campos existían en el modelo pero nunca se llenaban solos.
ORDEN_ESTADO_DD = [valor for valor, _ in Novedades.ESTADO_DD_CHOICES]
CAMPO_TIMESTAMP_POR_ESTADO = {
    "ENCOLADO": "fecha_recepcion_dd",
    "EN_REVISION": "fecha_inicio_revision",
    "TERMINADO": "fecha_fin_revision",
}


def _completar_timestamps_hasta(novedad, estado_alcanzado, ahora, valores_explicitos):
    """
    Para cada etapa <= estado_alcanzado (según ORDEN_ESTADO_DD) cuyo timestamp
    siga en None en `novedad` y no venga ya explícito en `valores_explicitos`
    (el payload de la request), devuelve {campo: ahora}. Nunca pisa una fecha
    ya guardada ni un valor que el propio caller haya mandado explícito.
    """
    if estado_alcanzado not in ORDEN_ESTADO_DD:
        return {}
    idx = ORDEN_ESTADO_DD.index(estado_alcanzado)
    return {
        campo: ahora
        for estado, campo in CAMPO_TIMESTAMP_POR_ESTADO.items()
        if ORDEN_ESTADO_DD.index(estado) <= idx
        and getattr(novedad, campo) is None
        and campo not in valores_explicitos
    }


def _serializar_novedad(novedad, detalle=False, horario=None):
    sla = calcular_sla_novedad(novedad, horario=horario)
    espera = calcular_espera_dd(novedad)
    data = {
        'id': novedad.id,
        'codigo_novedad': novedad.codigo_novedad,

        'cliente_id': novedad.cliente.id,
        'cliente': novedad.cliente.nombre,

        'vehiculo_id': novedad.vehiculo.id,
        'vehiculo': novedad.vehiculo.placa,
        'placa': novedad.vehiculo.placa,
        'numero_interno': novedad.vehiculo.numero_interno,

        'grupo_flota_id': novedad.grupo_flota.id,
        'grupo_flota': novedad.grupo_flota.nombre_grupo,

        'area_solicitante_id': novedad.area_solicitante.id,
        'area_solicitante': novedad.area_solicitante.nombre,

        'tipo_informe_id': novedad.tipo_informe.id,
        'tipo_informe': novedad.tipo_informe.nombre,

        'nivel_prioridad': novedad.nivel_prioridad,
        'nivel_prioridad_display': novedad.get_nivel_prioridad_display(),

        'categoria_informe_id':
            novedad.tipo_informe.categoria_informe.id,

        'categoria_informe':
            novedad.tipo_informe.categoria_informe.nombre_categoria_informe,

        'ruta_id': novedad.ruta.id,
        'ruta': novedad.ruta.origen + " ➡️ " + novedad.ruta.destino,

        'analista_id': novedad.analista.id,
        'analista': str(novedad.analista),

        'conductor': novedad.conductor,
        'nas': novedad.nas,
        'pasajeros_reportados': novedad.pasajeros_reportados,

        'fecha_novedad': novedad.fecha_novedad,
        'fecha_solicitud': novedad.fecha_solicitud,
        'fecha_recepcion_dd': novedad.fecha_recepcion_dd,
        'fecha_inicio_revision': novedad.fecha_inicio_revision,
        'fecha_fin_revision': novedad.fecha_fin_revision,

        'estado_dd': novedad.estado_dd,
        'estado_dd_display': novedad.get_estado_dd_display(),

        'respuesta_novedad': novedad.respuesta_novedad,

        'motivo_negativo_id': novedad.motivo_negativo_id,
        'motivo_negativo': novedad.motivo_negativo.nombre if novedad.motivo_negativo_id else None,
        'detalle_motivo_negativo': novedad.detalle_motivo_negativo,

        'motivo_positivo_id': novedad.motivo_positivo_id,
        'motivo_positivo': novedad.motivo_positivo.nombre if novedad.motivo_positivo_id else None,
        'detalle_motivo_positivo': novedad.detalle_motivo_positivo,

        'estado_novedad': novedad.estado_novedad,
        'estado_novedad_display': novedad.get_estado_novedad_display(),

        'tiene_informe': novedad.informes.exists(),

        'observaciones': novedad.observaciones,

        'fecha_creacion': novedad.fecha_creacion,
        'fecha_actualizacion': novedad.fecha_actualizacion,

        'sla_horas': sla['sla_horas'],
        'sla_horas_transcurridas': sla['horas_habiles_transcurridas'],
        'sla_horas_restantes': sla['horas_habiles_restantes'],
        'sla_estado': sla['sla_estado'],
        'sla_estado_display': sla['sla_estado_display'],

        'horas_espera_dd': espera['horas_espera_dd'],
        'en_espera_dd': espera['en_espera_dd'],
        'nivel_espera_dd': espera['nivel_espera_dd'],
    }

    if detalle:
        data['evidencias'] = [
            {
                'id': ev.id,
                'archivo': ev.archivo.url,
                'descripcion': ev.descripcion,
                'creado': ev.creado,
            }
            for ev in novedad.evidencias.all()
        ]

    return data


def novedades_view(request):
    if not request.user.is_authenticated:
        return _no_autenticado()
    if not tiene_permiso(request.user, "vista.novedades"):
        return _sin_permiso()
    horario = HorarioLaboral.get_actual()
    data = [_serializar_novedad(n, horario=horario) for n in _novedades_queryset()]
    return JsonResponse(data, safe=False)


def listar_ruta (request):
    listar_rutas = Ruta.objects.filter(estado=True)

    data = [
        {
            "value": ruta.id,
            "label": f"{ruta.origen} ➡️ {ruta.destino}"
        }
        for ruta in listar_rutas
    ]

    return JsonResponse(data, safe=False)

def formulario_novedades(request):
    return JsonResponse(NOVEDADES_FORM)

def categorias_tipos_informe(request):

    categorias = CategoriaTipoInforme.objects.prefetch_related(
        'categoria'
    )

    data = [
        {
            "id": categoria.id,
            "nombre": categoria.nombre_categoria_informe,
            "tipos": [
                {
                    "id": tipo.id,
                    "nombre": tipo.nombre
                }
                for tipo in categoria.categoria.filter(
                    activo=True
                )
            ]
        }
        for categoria in categorias
    ]

    return JsonResponse(data, safe=False)

def count_novedades_hoy(request):
    hoy = timezone.now().date()
    novedades_hoy = Novedades.objects.filter(fecha_novedad=hoy).aggregate(
        total=Count('id')
    )['total']

    return JsonResponse({"novedades_hoy": novedades_hoy})

def count_informes_pendientes(request):
    informes_pendientes = Novedades.objects.filter(estado_novedad='Pendiente_por_responder').aggregate(
        total=Count('id')
    )['total']

    return JsonResponse({"informes_pendientes": informes_pendientes})

@ensure_csrf_cookie
def get_csrf_token(request):
    """
    Endpoint dedicado para forzar que Django setee la cookie 'csrftoken'
    en el navegador del frontend. El frontend debe llamarlo una vez al arrancar.
    También devuelve el token en el body: cuando frontend y backend viven en
    hosts distintos (p.ej. túneles de desarrollo), JS no puede leer la cookie
    entre dominios, así que el frontend usa este valor como respaldo.
    """
    return JsonResponse({"detail": "CSRF cookie set", "csrftoken": get_token(request)})

class CrearNovedad(View):
    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "novedades.crear"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)

            novedad = Novedades.objects.create(
                analista = request.user,
                vehiculo_id = data["vehiculo_id"],
                cliente_id = data["cliente_id"],
                grupo_flota_id = data["grupo_flota_id"],
                conductor = data["conductor"],
                ruta_id = data["ruta"],
                area_solicitante_id = data["area_solicitante"],
                tipo_informe_id = data["tipo_informe"],
                estado_dd = data["estado_dd"],
                fecha_novedad = data["fecha_novedad"],
                fecha_solicitud = data["fecha_solicitud"],
                observaciones = data["observaciones"],
            )

            extra = _completar_timestamps_hasta(novedad, novedad.estado_dd, timezone.now(), {})
            if extra:
                for campo, valor in extra.items():
                    setattr(novedad, campo, valor)
                novedad.save(update_fields=list(extra.keys()))

            return JsonResponse({
                "success": True,
                "codigo": novedad.codigo_novedad,
                "mensaje": "La novedad fue creada correctamente.."
            })
        except KeyError as e:
            return JsonResponse({"success": False, "mensaje": f"Falta el campo {e}."}, status=400)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class NovedadDetalleView(View):
    """
    GET  /api/novedades/<id>/  -> detalle completo (incluye evidencias adjuntas)
    POST /api/novedades/<id>/  -> actualiza los campos editables (whitelist real,
                                   antes esta vista aceptaba cualquier clave del
                                   JSON vía setattr genérico sin validar nada).
    """

    # claves del form -> atributo real del modelo (para FKs enviadas como id).
    # Estas nunca se limpian a null desde este endpoint — son obligatorias.
    CAMPOS_FK = {
        "vehiculo_id": "vehiculo_id",
        "cliente_id": "cliente_id",
        "grupo_flota_id": "grupo_flota_id",
        "ruta": "ruta_id",
        "area_solicitante": "area_solicitante_id",
        "tipo_informe": "tipo_informe_id",
    }

    # FKs opcionales: null explícito sí las limpia (ej. al pasar de Negativa
    # a Positiva hay que poder borrar el motivo ya seleccionado).
    CAMPOS_FK_OPCIONALES = {
        "motivo_negativo_id": "motivo_negativo_id",
        "motivo_positivo_id": "motivo_positivo_id",
    }

    CAMPOS_SIMPLES = {
        "conductor", "estado_dd", "fecha_novedad", "fecha_solicitud",
        "observaciones", "respuesta_novedad", "detalle_motivo_negativo",
        "detalle_motivo_positivo",
        "pasajeros_reportados", "estado_novedad",
        "fecha_recepcion_dd", "fecha_inicio_revision", "fecha_fin_revision",
    }

    # cambios en estos campos quedan registrados en NovedadEvento
    CAMPOS_TRAZABLES = {"estado_dd", "respuesta_novedad"}

    def get(self, request, novedad_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "vista.novedades"):
            return _sin_permiso()
        try:
            novedad = _novedades_queryset().get(id=novedad_id)
        except Novedades.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La novedad no existe."}, status=404)
        return JsonResponse(_serializar_novedad(novedad, detalle=True))

    def post(self, request, novedad_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "novedades.editar"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            novedad = Novedades.objects.get(id=novedad_id)

            cambios_trazables = []
            for campo in self.CAMPOS_TRAZABLES:
                if campo in data:
                    valor_anterior = getattr(novedad, campo)
                    valor_nuevo = data[campo]
                    if str(valor_anterior) != str(valor_nuevo):
                        cambios_trazables.append((campo, valor_anterior, valor_nuevo))

            if "estado_dd" in data:
                data.update(_completar_timestamps_hasta(novedad, data["estado_dd"], timezone.now(), data))

            # "Generar informe" en la tabla de Novedades (y el conteo de
            # "informes pendientes" del dashboard) dependen de
            # estado_novedad -- pero nada lo movía nunca de su default
            # ('Pendiente_por_responder'): la pantalla de revisión (Stepper +
            # Resultado de la revisión) solo mandaba estado_dd/
            # respuesta_novedad, nunca este campo, así que quedaba
            # congelado para siempre aunque la revisión ya estuviera
            # terminada. Se deriva acá, salvo que el payload lo traiga
            # explícito (para no pisar un futuro flujo que sí lo maneje a mano).
            if "respuesta_novedad" in data and "estado_novedad" not in data:
                data["estado_novedad"] = "Completado" if data["respuesta_novedad"] else "Pendiente_por_responder"

            for clave, atributo in self.CAMPOS_FK.items():
                if clave in data and data[clave] not in (None, ""):
                    setattr(novedad, atributo, data[clave])

            for clave, atributo in self.CAMPOS_FK_OPCIONALES.items():
                if clave in data:
                    setattr(novedad, atributo, data[clave] or None)

            for clave in self.CAMPOS_SIMPLES:
                if clave in data:
                    setattr(novedad, clave, data[clave])

            novedad.save()

            usuario = request.user if request.user.is_authenticated else None
            for campo, valor_anterior, valor_nuevo in cambios_trazables:
                NovedadEvento.objects.create(
                    novedad=novedad,
                    campo=campo,
                    valor_anterior=valor_anterior,
                    valor_nuevo=valor_nuevo,
                    usuario=usuario,
                )

            return JsonResponse({
                "success": True,
                "mensaje": "La novedad fue actualizada correctamente."
            })
        except Novedades.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La novedad no existe."}, status=404)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class AsignarAnalista(View):
    """
    Reasigna el analista responsable de una novedad — acción de super
    usuario (is_staff=True), separada de NovedadDetalleView.post() porque es
    una decisión administrativa distinta a que el propio analista edite su
    revisión. Queda registrada en NovedadEvento igual que estado_dd/
    respuesta_novedad, para que la Trazabilidad muestre quién reasignó a
    quién y cuándo.
    """

    def post(self, request, novedad_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "novedades.asignar_analista"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            novedad = Novedades.objects.select_related("analista").get(id=novedad_id)
            nuevo_analista = UsuariosColfenix.objects.get(id=data["analista_id"], is_active=True)
        except Novedades.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La novedad no existe."}, status=404)
        except UsuariosColfenix.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El analista no existe o no está activo."}, status=404)
        except KeyError:
            return JsonResponse({"success": False, "mensaje": "Falta el campo analista_id."}, status=400)

        anterior = str(novedad.analista)
        if novedad.analista_id == nuevo_analista.id:
            return JsonResponse({"success": True, "mensaje": "La novedad ya estaba asignada a ese analista."})

        novedad.analista = nuevo_analista
        novedad.save()

        NovedadEvento.objects.create(
            novedad=novedad,
            campo="analista",
            valor_anterior=anterior,
            valor_nuevo=str(nuevo_analista),
            usuario=request.user,
        )

        return JsonResponse({"success": True, "mensaje": f"Novedad asignada a {nuevo_analista}."})


def metricas_analistas(request):
    """
    Por cada analista (rol contiene "analista", activo): cuántas novedades
    tiene asignadas hoy (novedad.analista actual, no histórico), cuántas ya
    respondió (estado_novedad distinto de Pendiente_por_responder), el
    desglose Positiva/Negativa, el tiempo de respuesta (horas hábiles desde
    ENCOLADO hasta TERMINADO — mismo cálculo que el SLA, promediado sobre
    sus novedades ya cerradas) y los informes que ha generado, con enlace a
    cada uno. Reservado a is_staff=True.
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    if not tiene_permiso(request.user, "vista.administracion_metricas"):
        return _sin_permiso()

    horario = HorarioLaboral.get_actual()

    analistas = UsuariosColfenix.objects.filter(rol__icontains="analista", is_active=True).annotate(
        total=Count("novedades"),
        respondidas=Count("novedades", filter=~Q(novedades__estado_novedad="Pendiente_por_responder")),
        positivas=Count("novedades", filter=Q(novedades__respuesta_novedad="Positiva")),
        negativas=Count("novedades", filter=Q(novedades__respuesta_novedad="Negativa")),
    )

    data = []
    todos_los_tiempos = []

    for a in analistas:
        cerradas = Novedades.objects.filter(
            analista=a, fecha_recepcion_dd__isnull=False, fecha_fin_revision__isnull=False,
        )
        tiempos = [
            horas_habiles_entre(n.fecha_recepcion_dd, n.fecha_fin_revision, horario)
            for n in cerradas
        ]
        todos_los_tiempos.extend(tiempos)

        informes_qs = Informe.objects.filter(novedad__analista=a).select_related(
            "novedad", "tipo_informe"
        )
        informes = [
            {
                "id": inf.id,
                "codigo": inf.codigo,
                "resultado": inf.resultado,
                "fecha_creacion": inf.fecha_creacion,
                "novedad_codigo": inf.novedad.codigo_novedad,
                "tipo_informe": inf.tipo_informe.nombre if inf.tipo_informe_id else None,
            }
            for inf in informes_qs
        ]

        data.append({
            "analista_id": a.id,
            "analista": str(a),
            "rol": a.rol,
            "total": a.total,
            "respondidas": a.respondidas,
            "pendientes": a.total - a.respondidas,
            "positivas": a.positivas,
            "negativas": a.negativas,
            "tiempo_respuesta_promedio_horas": round(sum(tiempos) / len(tiempos), 2) if tiempos else None,
            "tiempo_respuesta_minimo_horas": round(min(tiempos), 2) if tiempos else None,
            "tiempo_respuesta_maximo_horas": round(max(tiempos), 2) if tiempos else None,
            "informes_generados": len(informes),
            "informes": informes,
        })

    # El "cuadro de tareas" prioriza visualmente a quien más informes ha producido.
    data.sort(key=lambda d: d["informes_generados"], reverse=True)

    return JsonResponse({
        "analistas": data,
        "total_general": Novedades.objects.count(),
        "total_asignadas": sum(d["total"] for d in data),
        "total_informes": sum(d["informes_generados"] for d in data),
        "tiempo_respuesta_equipo_horas": (
            round(sum(todos_los_tiempos) / len(todos_los_tiempos), 2) if todos_los_tiempos else None
        ),
    })


class EliminarNovedad(View):
    def delete(self, request, novedad_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "novedades.eliminar"):
            return _sin_permiso()
        try:
            novedad = Novedades.objects.get(id=novedad_id)
            novedad.delete()

            return JsonResponse({
                "success": True,
                "mensaje": "La novedad fue eliminada correctamente."
            })

        except Novedades.DoesNotExist:
            return JsonResponse({
                "success": False,
                "mensaje": "La novedad no existe."
            }, status=404)


def listar_eventos_novedad(request, novedad_id):
    if not request.user.is_authenticated:
        return _no_autenticado()
    if not tiene_permiso(request.user, "vista.novedades"):
        return _sin_permiso()
    eventos = NovedadEvento.objects.filter(novedad_id=novedad_id).select_related('usuario')

    data = [
        {
            "id": evento.id,
            "campo": evento.campo,
            "valor_anterior": evento.valor_anterior,
            "valor_nuevo": evento.valor_nuevo,
            "usuario": str(evento.usuario) if evento.usuario else None,
            "creado": evento.creado,
        }
        for evento in eventos
    ]

    return JsonResponse(data, safe=False)


class EvidenciaNovedad(View):
    def post(self, request, novedad_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "novedades.subir_evidencia"):
            return _sin_permiso()
        try:
            novedad = Novedades.objects.get(id=novedad_id)
        except Novedades.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La novedad no existe."}, status=404)

        archivo = request.FILES.get("archivo")
        if not archivo:
            return JsonResponse({"success": False, "mensaje": "No se recibió ningún archivo."}, status=400)

        evidencia = NovedadEvidencia.objects.create(
            novedad=novedad,
            archivo=archivo,
            descripcion=request.POST.get("descripcion", ""),
        )

        return JsonResponse({
            "success": True,
            "evidencia": {
                "id": evidencia.id,
                "archivo": evidencia.archivo.url,
                "descripcion": evidencia.descripcion,
                "creado": evidencia.creado,
            },
        })


class EliminarEvidenciaNovedad(View):
    """
    DELETE /api/novedades/evidencia/<evidencia_id>/eliminar/ -- quita una
    imagen de evidencia ya subida (la "X" en el thumbnail). Mismo permiso
    que subirla (novedades.subir_evidencia): quien puede adjuntar evidencia
    también puede corregir un archivo subido por error.
    """

    def delete(self, request, evidencia_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "novedades.subir_evidencia"):
            return _sin_permiso()
        try:
            evidencia = NovedadEvidencia.objects.get(id=evidencia_id)
        except NovedadEvidencia.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La evidencia no existe."}, status=404)
        evidencia.archivo.delete(save=False)
        evidencia.delete()
        return JsonResponse({"success": True})


def listar_motivos_negativa(request):
    motivos = MotivoNegativo.objects.filter(activo=True)

    data = [
        {"value": motivo.id, "label": motivo.nombre}
        for motivo in motivos
    ]

    return JsonResponse(data, safe=False)


class CrearMotivoNegativoRapido(View):
    """
    POST /api/motivos-negativa/crear/ -- agregar un motivo de negativa nuevo
    directo desde "Resultado de la revisión" en el flujo de DVR. A
    diferencia de AdminMotivosNegativa (catálogo completo, con activar/
    desactivar/editar, reservado a administracion.gestionar_novedades), acá
    cualquier usuario autenticado puede agregar una opción nueva si el
    catálogo no cubre su caso -- no depende del rol.
    """

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        try:
            data = json.loads(request.body)
            nombre = (data.get("nombre") or "").strip()
            if not nombre:
                return JsonResponse({"success": False, "mensaje": "El nombre del motivo es obligatorio."}, status=400)
            motivo, creado = MotivoNegativo.objects.get_or_create(nombre=nombre)
            if not creado and not motivo.activo:
                motivo.activo = True
                motivo.save(update_fields=["activo"])
            return JsonResponse({"success": True, "motivo": {"value": motivo.id, "label": motivo.nombre}})
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)


class AdminMotivosNegativa(View):
    """
    Catálogo de motivos de negativa administrable desde la pantalla de
    Administración — reservado a usuarios con is_staff=True.
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        motivos = MotivoNegativo.objects.all()
        data = [
            {
                "id": motivo.id,
                "nombre": motivo.nombre,
                "descripcion": motivo.descripcion,
                "activo": motivo.activo,
            }
            for motivo in motivos
        ]
        return JsonResponse(data, safe=False)

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            motivo = MotivoNegativo.objects.create(
                nombre=data["nombre"],
                descripcion=data.get("descripcion", ""),
            )
            return JsonResponse({
                "success": True,
                "motivo": {"id": motivo.id, "nombre": motivo.nombre, "descripcion": motivo.descripcion, "activo": motivo.activo},
            })
        except KeyError as e:
            return JsonResponse({"success": False, "mensaje": f"Falta el campo {e}."}, status=400)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class AdminMotivoNegativoDetalle(View):
    def post(self, request, motivo_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            motivo = MotivoNegativo.objects.get(id=motivo_id)
            for campo in ("nombre", "descripcion", "activo"):
                if campo in data:
                    setattr(motivo, campo, data[campo])
            motivo.save()
            return JsonResponse({"success": True, "mensaje": "Motivo actualizado correctamente."})
        except MotivoNegativo.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El motivo no existe."}, status=404)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


def listar_motivos_positiva(request):
    motivos = MotivoPositivo.objects.filter(activo=True)

    data = [
        {"value": motivo.id, "label": motivo.nombre}
        for motivo in motivos
    ]

    return JsonResponse(data, safe=False)


class CrearMotivoPositivoRapido(View):
    """Equivalente a CrearMotivoNegativoRapido, para motivos de positiva."""

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        try:
            data = json.loads(request.body)
            nombre = (data.get("nombre") or "").strip()
            if not nombre:
                return JsonResponse({"success": False, "mensaje": "El nombre del motivo es obligatorio."}, status=400)
            motivo, creado = MotivoPositivo.objects.get_or_create(nombre=nombre)
            if not creado and not motivo.activo:
                motivo.activo = True
                motivo.save(update_fields=["activo"])
            return JsonResponse({"success": True, "motivo": {"value": motivo.id, "label": motivo.nombre}})
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)


class AdminMotivosPositiva(View):
    """
    Catálogo de motivos de positiva administrable desde la pantalla de
    Administración — reservado a usuarios con is_staff=True.
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        motivos = MotivoPositivo.objects.all()
        data = [
            {
                "id": motivo.id,
                "nombre": motivo.nombre,
                "descripcion": motivo.descripcion,
                "activo": motivo.activo,
            }
            for motivo in motivos
        ]
        return JsonResponse(data, safe=False)

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            motivo = MotivoPositivo.objects.create(
                nombre=data["nombre"],
                descripcion=data.get("descripcion", ""),
            )
            return JsonResponse({
                "success": True,
                "motivo": {"id": motivo.id, "nombre": motivo.nombre, "descripcion": motivo.descripcion, "activo": motivo.activo},
            })
        except KeyError as e:
            return JsonResponse({"success": False, "mensaje": f"Falta el campo {e}."}, status=400)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class AdminMotivoPositivoDetalle(View):
    def post(self, request, motivo_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            motivo = MotivoPositivo.objects.get(id=motivo_id)
            for campo in ("nombre", "descripcion", "activo"):
                if campo in data:
                    setattr(motivo, campo, data[campo])
            motivo.save()
            return JsonResponse({"success": True, "mensaje": "Motivo actualizado correctamente."})
        except MotivoPositivo.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El motivo no existe."}, status=404)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class AdminHorarioLaboral(View):
    """
    Horario laboral usado para calcular el SLA de revisión de DVR (horas
    hábiles entre ENCOLADO y TERMINADO) — fila única, administrable desde
    /api/admin/horario-laboral/ por un usuario is_staff=True.
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        horario = HorarioLaboral.get_actual()
        data = {dia: getattr(horario, dia) for dia in HorarioLaboral.DIAS_ORDEN}
        data["hora_inicio"] = horario.hora_inicio.strftime("%H:%M")
        data["hora_fin"] = horario.hora_fin.strftime("%H:%M")
        return JsonResponse(data)

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            horario = HorarioLaboral.get_actual()
            for dia in HorarioLaboral.DIAS_ORDEN:
                if dia in data:
                    setattr(horario, dia, bool(data[dia]))
            if "hora_inicio" in data:
                horario.hora_inicio = data["hora_inicio"]
            if "hora_fin" in data:
                horario.hora_fin = data["hora_fin"]
            horario.save()
            return JsonResponse({"success": True, "mensaje": "Horario laboral actualizado correctamente."})
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)
