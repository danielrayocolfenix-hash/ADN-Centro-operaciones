import json
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token
from django.utils import timezone
from django.db.models import Count
from django.db.models import Count, Q
from apps.novedades.models import Novedades, MotivoNegativo, MotivoPositivo, NovedadEvento, NovedadEvidencia, HorarioLaboral, EtapaFlujo
from apps.novedades.horario_laboral import calcular_sla_novedad, calcular_espera_dd, horas_habiles_entre
from apps.novedades.etapas import CRITERIOS_ETAPA
from apps.novedades.notificaciones import notificar_caso_en_revision
from apps.novedades.views_portal import _serializar_novedad_portal
from apps.Vehiculo.models import Ruta, DispositivoDVR, ConfiguracionDVR
from apps.Vehiculo.pila import calcular_estado_pila
from apps.Informes.models import CategoriaTipoInforme, Informe
from apps.novedades.forms_schema import NOVEDADES_FORM
from apps.usuarios_colfenix.models import UsuariosColfenix
from apps.configuracion.permisos import tiene_permiso, es_cliente_de


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
        'dispositivo_dvr',
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
    # Se calcula una sola vez y se reutiliza abajo (tiene_informe/informe_id
    # en el listado, data['informe'] en el detalle) -- antes el detalle
    # volvía a pedirlo con la misma consulta.
    ultimo_informe = novedad.informes.order_by('-fecha_creacion').first()
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

        'dispositivo_dvr_id': novedad.dispositivo_dvr_id,
        'dispositivo_dvr': str(novedad.dispositivo_dvr) if novedad.dispositivo_dvr_id else None,
        'fecha_ingreso_dvr': novedad.fecha_ingreso_dvr,
        'fecha_salida_dvr': novedad.fecha_salida_dvr,

        'respuesta_cliente': novedad.respuesta_cliente,
        'comentario_cliente': novedad.comentario_cliente,
        'fecha_respuesta_cliente': novedad.fecha_respuesta_cliente,
        'respondido_por_cliente': str(novedad.respondido_por_cliente) if novedad.respondido_por_cliente_id else None,

        'motivo_negativo_id': novedad.motivo_negativo_id,
        'motivo_negativo': novedad.motivo_negativo.nombre if novedad.motivo_negativo_id else None,
        'detalle_motivo_negativo': novedad.detalle_motivo_negativo,

        'motivo_positivo_id': novedad.motivo_positivo_id,
        'motivo_positivo': novedad.motivo_positivo.nombre if novedad.motivo_positivo_id else None,
        'detalle_motivo_positivo': novedad.detalle_motivo_positivo,

        'estado_novedad': novedad.estado_novedad,
        'estado_novedad_display': novedad.get_estado_novedad_display(),

        # informe_id: para que el listado de Novedades pueda abrir
        # directamente el informe ya generado en vez de mandar a crear uno
        # nuevo cuando ya existe (ver NovedadesPage.jsx).
        'tiene_informe': ultimo_informe is not None,
        'informe_id': ultimo_informe.id if ultimo_informe else None,

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
        meses_caducidad = ConfiguracionDVR.get_actual().meses_caducidad_pila
        data['dispositivos_dvr_disponibles'] = [
            {
                'id': d.id,
                'numero_maquina': d.numero_maquina,
                'marca': d.marca,
                'label': str(d),
                **calcular_estado_pila(d.fecha_ultimo_cambio_pila, meses_caducidad),
            }
            for d in novedad.vehiculo.dispositivos_dvr.all()
        ]
        data['informe'] = {
            'id': ultimo_informe.id,
            'codigo': ultimo_informe.codigo,
            'resultado': ultimo_informe.resultado,
            'fecha_creacion': ultimo_informe.fecha_creacion,
        } if ultimo_informe else None

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

def count_alertas_criticas(request):
    """
    GET /api/novedades/alertas-criticas/count/ -- misma fórmula que ya usan
    NovedadesPage.jsx y DashboardPage.jsx en el frontend (Prioridad_Alta sin
    cerrar), acá para el badge del ícono "Novedades" del sidebar -- antes
    ese número salía de datos mock, sin relación con la base real.
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    alertas = Novedades.objects.filter(
        nivel_prioridad='Prioridad_Alta',
    ).exclude(estado_novedad='Completado').aggregate(total=Count('id'))['total']

    return JsonResponse({"alertas_criticas": alertas})

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
        "dispositivo_dvr_id": "dispositivo_dvr_id",
        "motivo_negativo_id": "motivo_negativo_id",
        "motivo_positivo_id": "motivo_positivo_id",
    }

    CAMPOS_SIMPLES = {
        "conductor", "estado_dd", "fecha_novedad", "fecha_solicitud",
        "observaciones", "respuesta_novedad", "detalle_motivo_negativo",
        "detalle_motivo_positivo",
        "pasajeros_reportados", "estado_novedad",
        "fecha_recepcion_dd", "fecha_inicio_revision", "fecha_fin_revision",
        "fecha_ingreso_dvr", "fecha_salida_dvr",
    }

    # cambios en estos campos quedan registrados en NovedadEvento
    CAMPOS_TRAZABLES = {"estado_dd", "respuesta_novedad", "fecha_salida_dvr"}

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

            if data.get("fecha_salida_dvr") and not novedad.informes.exists():
                return JsonResponse({
                    "success": False,
                    "mensaje": "No se puede registrar la fecha de salida antes de generar el informe.",
                }, status=400)

            cambios_trazables = []
            for campo in self.CAMPOS_TRAZABLES:
                if campo in data:
                    valor_anterior = getattr(novedad, campo)
                    valor_nuevo = data[campo]
                    if str(valor_anterior) != str(valor_nuevo):
                        cambios_trazables.append((campo, valor_anterior, valor_nuevo))

            # Si cambia el vehículo de la novedad (modal "Editar" del listado,
            # que reutiliza este mismo endpoint), el dispositivo_dvr ya
            # asignado queda apuntando al vehículo anterior -- se limpia acá
            # en vez de dejar una referencia inconsistente.
            if "vehiculo_id" in data and str(data["vehiculo_id"]) != str(novedad.vehiculo_id):
                data["dispositivo_dvr_id"] = None
                data["fecha_ingreso_dvr"] = None
                data["fecha_salida_dvr"] = None

            # Traza legible del cambio de dispositivo DVR -- manual porque es
            # una FK y queremos el texto ("Máquina 1 · Marca"), no el id
            # crudo, en NovedadEvento. La fecha de ingreso se sella sola acá,
            # la primera vez que se asigna un dispositivo -- no se traza
            # aparte, ocurre en el mismo evento que el cambio de dispositivo.
            if "dispositivo_dvr_id" in data:
                nuevo_id = data["dispositivo_dvr_id"] or None
                if nuevo_id != novedad.dispositivo_dvr_id:
                    anterior_dvr = novedad.dispositivo_dvr
                    nuevo_dvr = DispositivoDVR.objects.filter(id=nuevo_id).first() if nuevo_id else None
                    cambios_trazables.append((
                        "dispositivo_dvr",
                        str(anterior_dvr) if anterior_dvr else None,
                        str(nuevo_dvr) if nuevo_dvr else None,
                    ))
                    if nuevo_dvr and not novedad.fecha_ingreso_dvr:
                        data["fecha_ingreso_dvr"] = timezone.now()

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
                if campo == "estado_dd" and valor_nuevo == "EN_REVISION":
                    notificar_caso_en_revision(novedad)

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

    Acepta ?desde=YYYY-MM-DD y/o ?hasta=YYYY-MM-DD opcionales -- acotan
    todo por Novedades.fecha_novedad. Sin ninguno de los dos, el
    comportamiento es exactamente el de siempre (todo el histórico); se
    agregó para que el modal de "Configurar exportación" de Métricas de
    analistas pueda generar un Excel de un rango puntual sin tocar lo que
    ve la pantalla por defecto.
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    if not tiene_permiso(request.user, "vista.administracion_metricas"):
        return _sin_permiso()

    horario = HorarioLaboral.get_actual()

    desde = request.GET.get("desde") or None
    hasta = request.GET.get("hasta") or None

    # Q() vacío no impone ninguna condición, así que sin desde/hasta el
    # filtro combinado con `&` deja cada Count exactamente como estaba.
    filtro_rango = Q()
    if desde:
        filtro_rango &= Q(novedades__fecha_novedad__gte=desde)
    if hasta:
        filtro_rango &= Q(novedades__fecha_novedad__lte=hasta)

    analistas = UsuariosColfenix.objects.filter(rol__icontains="analista", is_active=True).annotate(
        total=Count("novedades", filter=filtro_rango),
        respondidas=Count("novedades", filter=filtro_rango & ~Q(novedades__estado_novedad="Pendiente_por_responder")),
        positivas=Count("novedades", filter=filtro_rango & Q(novedades__respuesta_novedad="Positiva")),
        negativas=Count("novedades", filter=filtro_rango & Q(novedades__respuesta_novedad="Negativa")),
    )

    data = []
    todos_los_tiempos = []

    for a in analistas:
        cerradas = Novedades.objects.filter(
            analista=a, fecha_recepcion_dd__isnull=False, fecha_fin_revision__isnull=False,
        )
        if desde:
            cerradas = cerradas.filter(fecha_novedad__gte=desde)
        if hasta:
            cerradas = cerradas.filter(fecha_novedad__lte=hasta)
        tiempos = [
            horas_habiles_entre(n.fecha_recepcion_dd, n.fecha_fin_revision, horario)
            for n in cerradas
        ]
        todos_los_tiempos.extend(tiempos)

        informes_qs = Informe.objects.filter(novedad__analista=a).select_related(
            "novedad", "tipo_informe"
        )
        if desde:
            informes_qs = informes_qs.filter(novedad__fecha_novedad__gte=desde)
        if hasta:
            informes_qs = informes_qs.filter(novedad__fecha_novedad__lte=hasta)
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

    novedades_rango = Novedades.objects.all()
    if desde:
        novedades_rango = novedades_rango.filter(fecha_novedad__gte=desde)
    if hasta:
        novedades_rango = novedades_rango.filter(fecha_novedad__lte=hasta)

    return JsonResponse({
        "analistas": data,
        "total_general": novedades_rango.count(),
        "total_asignadas": sum(d["total"] for d in data),
        "total_informes": sum(d["informes_generados"] for d in data),
        "tiempo_respuesta_equipo_horas": (
            round(sum(todos_los_tiempos) / len(todos_los_tiempos), 2) if todos_los_tiempos else None
        ),
        "rango": {"desde": desde, "hasta": hasta},
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


def _serializar_etapa(e):
    return {
        "id": e.id,
        "clave": e.clave,
        "track": e.track,
        "track_display": e.get_track_display(),
        "nombre": e.nombre,
        "descripcion": e.descripcion,
        "orden": e.orden,
        "activo": e.activo,
    }


def listar_etapas_flujo(request):
    """
    GET /api/etapas-flujo/ -- catálogo de etapas activas, para que el
    asistente de NovedadDetallePage arme sus pasos con el nombre/descripción/
    orden ya configurados. A diferencia de AdminEtapasFlujo (reservado a
    administracion.gestionar_novedades, para editar), esto solo requiere
    sesión iniciada -- igual que listar_motivos_negativa/listar_motivos_positiva,
    cualquiera que pueda ver una novedad necesita poder leer esto.
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    etapas = EtapaFlujo.objects.filter(activo=True)
    return JsonResponse([_serializar_etapa(e) for e in etapas], safe=False)


class AdminEtapasFlujo(View):
    """
    GET /api/admin/etapas-flujo/ -- catálogo completo (ambos tracks), para la
    tarjeta "Etapas del flujo" de Administración › Configuración de novedades.
    Sin POST de creación a propósito: las etapas no se crean desde acá (ver
    EtapaFlujo.clean(), la clave debe ya tener criterio en
    apps.novedades.etapas.CRITERIOS_ETAPA), solo se editan/reordenan/activan
    las que ya sembró la migración de datos.
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        etapas = EtapaFlujo.objects.all()
        return JsonResponse([_serializar_etapa(e) for e in etapas], safe=False)


class AdminEtapaFlujoDetalle(View):
    """POST /api/admin/etapas-flujo/<id>/ -- edita nombre/descripcion/orden/activo."""

    def post(self, request, etapa_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            etapa = EtapaFlujo.objects.get(id=etapa_id)
        except EtapaFlujo.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La etapa no existe."}, status=404)
        try:
            data = json.loads(request.body)
            for campo in ("nombre", "descripcion"):
                if campo in data:
                    setattr(etapa, campo, data[campo])
            if "orden" in data:
                etapa.orden = int(data["orden"])
            if "activo" in data:
                etapa.activo = bool(data["activo"])
            etapa.save()
            return JsonResponse({"success": True, "etapa": _serializar_etapa(etapa)})
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class ClienteResponderNovedad(View):
    """
    POST /api/portal/novedades/<id>/responder/ -- el cliente registra su
    respuesta (Conforme/No conforme + comentario) sobre el informe ya
    generado. Endpoint propio, separado de NovedadDetalleView (que es
    staff-only vía el permiso novedades.editar): acá la autorización es "es
    un usuario tipo=CLIENTE dueño de esta novedad" (es_cliente_de), no un
    permiso de la tabla Permiso. Respuesta de una sola vía -- no hay edición
    posterior, igual de inmutable que el resto de NovedadEvento.
    """

    def post(self, request, novedad_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        try:
            novedad = Novedades.objects.get(id=novedad_id)
        except Novedades.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La novedad no existe."}, status=404)

        if not es_cliente_de(request.user, novedad):
            return _sin_permiso()

        if not CRITERIOS_ETAPA["informe"](novedad):
            return JsonResponse({
                "success": False,
                "mensaje": "Todavía no hay un informe generado para responder.",
            }, status=400)

        if novedad.respuesta_cliente:
            return JsonResponse({
                "success": False,
                "mensaje": "Esta novedad ya tiene una respuesta registrada.",
            }, status=400)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)

        respuesta = data.get("respuesta_cliente")
        if respuesta not in dict(Novedades.RESPUESTA_CLIENTE_CHOICES):
            return JsonResponse({"success": False, "mensaje": "Respuesta inválida."}, status=400)

        try:
            valor_anterior = novedad.respuesta_cliente
            novedad.respuesta_cliente = respuesta
            novedad.comentario_cliente = data.get("comentario_cliente", "")
            novedad.fecha_respuesta_cliente = timezone.now()
            novedad.respondido_por_cliente = request.user
            novedad.save()

            NovedadEvento.objects.create(
                novedad=novedad,
                campo="respuesta_cliente",
                valor_anterior=valor_anterior,
                valor_nuevo=respuesta,
                usuario=request.user,
            )
            return JsonResponse({"success": True, "mensaje": "Respuesta registrada correctamente."})
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


def _serializar_novedad_vista_cliente(n):
    """
    Igual al recorte de _serializar_novedad_portal, más el cliente dueño --
    el cliente mismo ya sabe cuál es (nunca se lo mandamos), pero acá el
    staff está viendo varios clientes a la vez y necesita distinguirlos.
    """
    data = _serializar_novedad_portal(n)
    data["cliente_id"] = n.cliente_id
    data["cliente"] = n.cliente.nombre
    return data


def staff_vista_cliente_listar_novedades(request):
    """
    GET /api/admin/vista-cliente/novedades/?cliente_id=<id> -- el mismo
    recorte de datos que ve un cliente en su portal, pero para que el staff
    (administracion.gestionar_novedades) lo revise con fines de soporte/demo.
    Sin `cliente_id` devuelve TODAS las novedades de TODOS los clientes --
    a propósito: un superadmin debe poder ver el conjunto completo, no solo
    cliente por cliente.
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
        return _sin_permiso()
    qs = Novedades.objects.select_related(
        'cliente', 'vehiculo', 'ruta', 'tipo_informe', 'tipo_informe__categoria_informe',
    ).prefetch_related('informes')
    cliente_id = request.GET.get("cliente_id")
    if cliente_id:
        qs = qs.filter(cliente_id=cliente_id)
    return JsonResponse([_serializar_novedad_vista_cliente(n) for n in qs], safe=False)


class StaffVistaClienteNovedadDetalle(View):
    """GET /api/admin/vista-cliente/novedades/<id>/ -- detalle de solo lectura, sin restricción de cliente."""

    def get(self, request, novedad_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            novedad = Novedades.objects.select_related(
                'cliente', 'vehiculo', 'ruta', 'tipo_informe', 'tipo_informe__categoria_informe',
            ).get(id=novedad_id)
        except Novedades.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La novedad no existe."}, status=404)
        return JsonResponse(_serializar_novedad_vista_cliente(novedad))


def sugerir_motivo(request, novedad_id):
    """
    GET /api/novedades/<id>/sugerir-motivo/?respuesta_novedad=Positiva|Negativa
    -- motivo más frecuente entre novedades históricas del MISMO vehículo y
    MISMO tipo de informe con esa respuesta -- asistente determinista (solo
    Count(), sin IA) para el paso "Decisión tomada" del flujo de revisión.
    No sugiere con un solo caso histórico (ruido, no patrón todavía).
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    try:
        novedad = Novedades.objects.get(id=novedad_id)
    except Novedades.DoesNotExist:
        return JsonResponse({"success": False, "mensaje": "La novedad no existe."}, status=404)

    respuesta = request.GET.get("respuesta_novedad")
    if respuesta not in ("Positiva", "Negativa"):
        return JsonResponse({"success": False, "mensaje": "respuesta_novedad debe ser Positiva o Negativa."}, status=400)

    campo_motivo = "motivo_negativo" if respuesta == "Negativa" else "motivo_positivo"
    qs = Novedades.objects.filter(
        vehiculo_id=novedad.vehiculo_id,
        tipo_informe_id=novedad.tipo_informe_id,
        respuesta_novedad=respuesta,
        **{f"{campo_motivo}__isnull": False},
    ).exclude(id=novedad_id)

    casos_considerados = qs.count()
    top = (
        qs.values(f"{campo_motivo}_id", f"{campo_motivo}__nombre")
        .annotate(total=Count("id"))
        .order_by("-total")
        .first()
    )
    if not top or top["total"] < 2:
        return JsonResponse({"sugerencia": None})

    return JsonResponse({
        "sugerencia": {
            "motivo_id": top[f"{campo_motivo}_id"],
            "nombre": top[f"{campo_motivo}__nombre"],
            "total": top["total"],
            "casos_considerados": casos_considerados,
        }
    })
