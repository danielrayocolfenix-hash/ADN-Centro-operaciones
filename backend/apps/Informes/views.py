import base64
import json
import uuid

from django.core.files.base import ContentFile
from django.db import transaction
from django.http import JsonResponse
from django.views import View

from apps.Informes.models import (
    CategoriaTipoInforme,
    DetalleInforme,
    EventoInforme,
    EvidenciaEvento,
    Informe,
    InformeLogiox,
    InformeRecorrido,
    SegmentoAnalizado,
    SolicitudImagen,
    TipoEvento,
    TipoInforme,
)
from apps.Informes.form_schema import FORM_INFORMES
from apps.novedades.models import Novedades
from apps.configuracion.permisos import tiene_permiso


def listar_tipoInforme (request):
    listar_all = TipoInforme.objects.filter(activo=True)
    data = [
        {
            'value': ti.id,
            'label': ti.nombre
        }
        for ti in listar_all
    ]
    return JsonResponse(data, safe=False)


def formulario_informes(request):
    return JsonResponse(FORM_INFORMES)


def _no_autenticado():
    return JsonResponse({"success": False, "mensaje": "Debes iniciar sesión."}, status=401)


def _sin_permiso():
    return JsonResponse({"success": False, "mensaje": "No tienes permisos para esta acción."}, status=403)


class AdminTiposInformeSLA(View):
    """
    Tiempo máximo (SLA, en horas hábiles) configurable por Tipo de Informe —
    administrable desde /api/admin/tipos-informe/ por un usuario is_staff=True.
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        tipos = TipoInforme.objects.select_related('categoria_informe').all()
        data = [
            {
                "id": t.id,
                "nombre": t.nombre,
                "categoria_informe": t.categoria_informe.nombre_categoria_informe if t.categoria_informe_id else None,
                "nivel_prioridad": t.nivel_prioridad,
                "nivel_prioridad_display": t.get_nivel_prioridad_display(),
                "activo": t.activo,
                "tiempo_maximo_horas": t.tiempo_maximo_horas,
            }
            for t in tipos
        ]
        return JsonResponse(data, safe=False)

    def post(self, request):
        """Crea un Tipo de Informe nuevo, con su categoría, prioridad y SLA
        de una sola vez (evita crear el tipo y luego ir a otra pantalla a
        asignarle el tiempo máximo)."""
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            tipo = TipoInforme.objects.create(
                nombre=data["nombre"],
                categoria_informe_id=data.get("categoria_informe_id") or None,
                nivel_prioridad=data.get("nivel_prioridad") or "Prioridad_Media",
                tiempo_maximo_horas=data.get("tiempo_maximo_horas") or None,
            )
            return JsonResponse({
                "success": True,
                "tipo": {"id": tipo.id, "nombre": tipo.nombre},
            })
        except KeyError as e:
            return JsonResponse({"success": False, "mensaje": f"Falta el campo {e}."}, status=400)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class AdminTipoInformeSLADetalle(View):
    def post(self, request, tipo_informe_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            tipo = TipoInforme.objects.get(id=tipo_informe_id)
            if "nombre" in data:
                tipo.nombre = data["nombre"]
            if "categoria_informe_id" in data:
                tipo.categoria_informe_id = data["categoria_informe_id"] or None
            if "nivel_prioridad" in data:
                tipo.nivel_prioridad = data["nivel_prioridad"]
            if "activo" in data:
                tipo.activo = bool(data["activo"])
            if "tiempo_maximo_horas" in data:
                tipo.tiempo_maximo_horas = data.get("tiempo_maximo_horas") or None
            tipo.full_clean()
            tipo.save()
            return JsonResponse({"success": True, "mensaje": "Tipo de informe actualizado correctamente."})
        except TipoInforme.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El tipo de informe no existe."}, status=404)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class AdminCategoriasTipoInforme(View):
    """
    Categorías que agrupan los Tipos de Informe (ej. "Novedad específica"
    agrupando Choque simple, Queja de pasajero, Fallecido...) — administrable
    desde /api/admin/categorias-tipo-informe/ por un usuario is_staff=True.
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        categorias = CategoriaTipoInforme.objects.all()
        data = [
            {"id": c.id, "nombre": c.nombre_categoria_informe, "estado": c.estado}
            for c in categorias
        ]
        return JsonResponse(data, safe=False)

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            categoria = CategoriaTipoInforme.objects.create(
                nombre_categoria_informe=data["nombre"],
            )
            return JsonResponse({
                "success": True,
                "categoria": {"id": categoria.id, "nombre": categoria.nombre_categoria_informe},
            })
        except KeyError as e:
            return JsonResponse({"success": False, "mensaje": f"Falta el campo {e}."}, status=400)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


def _contar_adjuntos_informe(informe):
    """Cuenta todas las imágenes adjuntas de un informe (Logiox, mapa del
    recorrido, capturas de la solicitud, evidencia de cada evento, y las de
    negativa) -- asume que `informe` ya viene con select_related/
    prefetch_related de logiox/recorrido/solicitud_imagenes/videos__eventos
    __evidencias/detalles, para no disparar queries extra por cada uno."""
    total = 0
    logiox = getattr(informe, "logiox", None)
    if logiox and logiox.imagen:
        total += 1
    total += len(informe.solicitud_imagenes.all())
    recorrido = getattr(informe, "recorrido", None)
    if recorrido and recorrido.imagen:
        total += 1
    for segmento in informe.videos.all():
        for evento in segmento.eventos.all():
            total += len(evento.evidencias.all())
    for detalle in informe.detalles.all():
        if detalle.imagen:
            total += 1
    return total


def _serializar_informe_lista(informe):
    return {
        "id": informe.id,
        "codigo": informe.codigo,
        "titulo": informe.titulo,
        "estado": informe.estado,
        "resultado": informe.resultado,
        "version": informe.version,
        "fecha_creacion": informe.fecha_creacion,
        "tipo_informe": informe.tipo_informe.nombre if informe.tipo_informe_id else None,
        "novedad_id": informe.novedad_id,
        "novedad_codigo": informe.novedad.codigo_novedad,
        "cliente": informe.novedad.cliente.nombre,
        "vehiculo": informe.novedad.vehiculo.placa,
        "numero_interno": informe.novedad.vehiculo.numero_interno,
        "analista": str(informe.novedad.analista),
        "cantidad_adjuntos": _contar_adjuntos_informe(informe),
    }


def _queryset_informes_completo():
    return Informe.objects.select_related(
        "novedad", "novedad__cliente", "novedad__vehiculo", "novedad__analista", "tipo_informe",
        "logiox", "recorrido",
    ).prefetch_related(
        "solicitud_imagenes", "videos__eventos__tipo", "videos__eventos__evidencias", "detalles",
    )


def listar_informes(request):
    """
    GET /api/informes/ -- listado real (nada de datos de prueba) para la
    pantalla de Informes legales. Requiere `vista.informes`, el mismo
    permiso que ya gatea la ruta /informes en el frontend.
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    if not tiene_permiso(request.user, "vista.informes"):
        return _sin_permiso()
    informes = _queryset_informes_completo().order_by("-fecha_creacion")
    return JsonResponse([_serializar_informe_lista(inf) for inf in informes], safe=False)


class InformeDetalleCompleto(View):
    """
    GET /api/informes/<informe_id>/ -- documento completo de un informe ya
    generado, con TODOS sus archivos adjuntos (Logiox, mapa del recorrido,
    capturas de la solicitud, evidencia de cada evento/segmento, imágenes de
    negativa) para poder mostrarlos/abrirlos desde la card del informe.
    """

    def get(self, request, informe_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "vista.informes"):
            return _sin_permiso()
        try:
            informe = _queryset_informes_completo().get(id=informe_id)
        except Informe.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El informe no existe."}, status=404)

        logiox = getattr(informe, "logiox", None)
        recorrido = getattr(informe, "recorrido", None)

        segmentos = []
        for segmento in informe.videos.all():
            eventos = [
                {
                    "id": evento.id,
                    "tipo": evento.tipo.nombre if evento.tipo_id else None,
                    "descripcion": evento.descripcion,
                    "evidencias": [
                        {"id": ev.id, "imagen": ev.imagen.url, "descripcion": ev.descripcion}
                        for ev in evento.evidencias.all()
                    ],
                }
                for evento in segmento.eventos.all()
            ]
            segmentos.append({
                "id": segmento.id,
                "orden": segmento.orden,
                "hora_inicio": segmento.hora_inicio,
                "hora_fin": segmento.hora_fin,
                "observacion": segmento.observacion,
                "eventos": eventos,
            })

        return JsonResponse({
            "id": informe.id,
            "codigo": informe.codigo,
            "titulo": informe.titulo,
            "estado": informe.estado,
            "resultado": informe.resultado,
            "version": informe.version,
            "solicitud": informe.solicitud,
            "anexos": informe.anexos,
            "fecha_creacion": informe.fecha_creacion,
            "tipo_informe": informe.tipo_informe.nombre if informe.tipo_informe_id else None,
            "novedad": {
                "id": informe.novedad.id,
                "codigo_novedad": informe.novedad.codigo_novedad,
                "cliente": informe.novedad.cliente.nombre,
                "vehiculo": informe.novedad.vehiculo.placa,
                "numero_interno": informe.novedad.vehiculo.numero_interno,
                "conductor": informe.novedad.conductor,
                "analista": str(informe.novedad.analista),
            },
            "logiox": {
                "modo": logiox.modo,
                "tabla": logiox.tabla,
                "imagen": logiox.imagen.url if logiox.imagen else None,
            } if logiox else None,
            "solicitud_imagenes": [
                {"id": si.id, "imagen": si.imagen.url, "orden": si.orden}
                for si in informe.solicitud_imagenes.all()
            ],
            "recorrido": {
                "texto_confirmacion": recorrido.texto_confirmacion,
                "intro_texto": recorrido.intro_texto,
                "imagen": recorrido.imagen.url if recorrido.imagen else None,
            } if recorrido else None,
            "segmentos": segmentos,
            "detalles": [
                {
                    "id": d.id, "titulo": d.titulo, "orden": d.orden,
                    "observacion": d.observacion,
                    "imagen": d.imagen.url if d.imagen else None,
                }
                for d in informe.detalles.all()
            ],
            "mantenimientos_tabla": informe.mantenimientos_tabla,
            "mantenimientos_nota": informe.mantenimientos_nota,
        })


class AdminInformeDetalle(View):
    """
    Detalle liviano de un Informe ya generado — usado por el "enlace" a cada
    informe en la vista de Métricas de analistas (is_staff=True). Distinto
    de InformeDetalleCompleto (que trae todos los adjuntos, para la pantalla
    de Informes legales): acá solo lo suficiente para identificar el informe
    sin tener que navegar a otra pantalla.
    """

    def get(self, request, informe_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "vista.administracion_metricas"):
            return _sin_permiso()
        try:
            informe = Informe.objects.select_related(
                "novedad", "novedad__cliente", "novedad__vehiculo", "novedad__analista", "tipo_informe",
            ).get(id=informe_id)
        except Informe.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El informe no existe."}, status=404)

        return JsonResponse({
            "id": informe.id,
            "codigo": informe.codigo,
            "titulo": informe.titulo,
            "estado": informe.estado,
            "resultado": informe.resultado,
            "version": informe.version,
            "fecha_creacion": informe.fecha_creacion,
            "tipo_informe": informe.tipo_informe.nombre if informe.tipo_informe_id else None,
            "novedad": {
                "id": informe.novedad.id,
                "codigo_novedad": informe.novedad.codigo_novedad,
                "cliente": informe.novedad.cliente.nombre,
                "vehiculo": informe.novedad.vehiculo.placa,
                "analista": str(informe.novedad.analista),
            },
        })


def _decode_base64_imagen(data_url, nombre_base):
    """
    El constructor de informes guarda las imágenes como data URL
    (FileReader.readAsDataURL) para poder previsualizarlas al instante en el
    navegador, así que llegan como base64 en el JSON en vez de multipart.
    Desde que se agregaron los controles de tamaño/alineación/borde, cada
    imagen llega como {"src": dataUrl, "width": ..., ...} en vez de un
    string plano — esas propiedades de presentación no se persisten aquí,
    solo el archivo en sí.
    """
    if isinstance(data_url, dict):
        data_url = data_url.get("src")
    if not data_url or not isinstance(data_url, str) or ";base64," not in data_url:
        return None
    header, encoded = data_url.split(";base64,", 1)
    extension = header.split("/")[-1].split("+")[0] if "/" in header else "png"
    try:
        binario = base64.b64decode(encoded)
    except (ValueError, TypeError):
        return None
    return ContentFile(binario, name=f"{nombre_base}-{uuid.uuid4().hex[:8]}.{extension}")


class GenerarInformeView(View):
    """
    POST /api/novedades/<novedad_id>/generar-informe/
    Crea un Informe real (con Logiox, Recorrido, segmentos, evidencia y,
    si el resultado es Negativa, mantenimientos/diagnóstico) a partir del
    payload que arma el constructor visual. Antes "Guardar informe" solo
    hacía console.log en el frontend, sin persistir nada.
    """

    def post(self, request, novedad_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "novedades.generar_informe"):
            return _sin_permiso()

        try:
            novedad = Novedades.objects.select_related("tipo_informe").get(id=novedad_id)
        except Novedades.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La novedad no existe."}, status=404)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)

        resultado = (data.get("resultado") or "").strip().lower()
        if resultado not in ("positiva", "negativa"):
            return JsonResponse({"success": False, "mensaje": "resultado debe ser 'positiva' o 'negativa'."}, status=400)

        compartido = data.get("compartido") or {}
        cuerpo = data.get("cuerpo") or {}

        try:
            with transaction.atomic():
                consecutivo = novedad.informes.count() + 1
                informe = Informe.objects.create(
                    codigo=f"INF-{novedad.codigo_novedad}-{consecutivo:02d}",
                    novedad=novedad,
                    tipo_informe=novedad.tipo_informe,
                    estado="Finalizado",
                    resultado=resultado.capitalize(),
                    version=data.get("version") or "Versión 1",
                    titulo=data.get("titulo_informe", ""),
                    solicitud=compartido.get("solicitudTexto", ""),
                    anexos=data.get("anexos", ""),
                    mantenimientos_tabla=(
                        {
                            "columnas": cuerpo.get("mantenimientosColumnas", []),
                            "filas": cuerpo.get("mantenimientosFilas", []),
                        }
                        if resultado == "negativa"
                        else {}
                    ),
                    mantenimientos_nota=cuerpo.get("notaMantenimientos", "") if resultado == "negativa" else "",
                )

                logiox_modo = compartido.get("logioxModo") or "tabla"
                InformeLogiox.objects.create(
                    informe=informe,
                    modo=logiox_modo,
                    tabla={
                        "columnas": compartido.get("logioxColumnas", []),
                        "filas": compartido.get("logioxFilas", []),
                    },
                    imagen=_decode_base64_imagen(compartido.get("logioxImagen"), "logiox") if logiox_modo == "imagen" else None,
                )

                for orden_solicitud, item in enumerate(compartido.get("solicitudImagenes", []), start=1):
                    imagen_solicitud = _decode_base64_imagen(item, "solicitud")
                    if imagen_solicitud:
                        SolicitudImagen.objects.create(informe=informe, imagen=imagen_solicitud, orden=orden_solicitud)

                mapa = _decode_base64_imagen(compartido.get("recorridoMapaImagen"), "recorrido")
                InformeRecorrido.objects.create(
                    informe=informe,
                    texto_confirmacion=compartido.get("recorridoTextoConfirmacion", "") if resultado == "positiva" else "",
                    intro_texto=compartido.get("recorridoIntroTexto", "") if resultado == "positiva" else "",
                    imagen=mapa,
                )

                orden = 0
                for segmento in compartido.get("recorridoSegmentos", []):
                    orden += 1
                    SegmentoAnalizado.objects.create(
                        informe=informe,
                        orden=orden,
                        hora_inicio=segmento.get("horaInicio") or None,
                        hora_fin=segmento.get("horaFin") or None,
                        observacion=segmento.get("etiqueta", ""),
                    )

                if resultado == "positiva":
                    eventos = [
                        event for event in cuerpo.get("eventosCamara", [])
                        if event.get("descripcion") or event.get("imagen")
                    ]
                    if eventos:
                        tipo_puntual, _ = TipoEvento.objects.get_or_create(
                            nombre="Novedad Puntual",
                            defaults={
                                "plantilla": "Se evidencia un evento puntual entre las {inicio} y las {fin} horas.",
                                "requiere_descripcion": True,
                            },
                        )
                        for event in eventos:
                            orden += 1
                            segmento_evento = SegmentoAnalizado.objects.create(
                                informe=informe,
                                orden=orden,
                                hora_inicio=event.get("horaInicio") or None,
                                hora_fin=event.get("horaFin") or None,
                                observacion=cuerpo.get("notaEvidencia", "") if orden == 1 else "",
                            )
                            evento_creado = EventoInforme.objects.create(
                                segmento=segmento_evento,
                                tipo=tipo_puntual,
                                orden=1,
                                descripcion=event.get("descripcion", ""),
                            )
                            imagen_evento = _decode_base64_imagen(event.get("imagen"), "evidencia")
                            if imagen_evento:
                                EvidenciaEvento.objects.create(
                                    evento=evento_creado,
                                    imagen=imagen_evento,
                                    orden=1,
                                )
                else:
                    bloques_negativa = [
                        ("Mantenimiento inicial", cuerpo.get("mantenimientoInicialTexto", ""), cuerpo.get("mantenimientoInicialImagen")),
                        ("Mantenimiento final", cuerpo.get("mantenimientoFinalTexto", ""), cuerpo.get("mantenimientoFinalImagen")),
                        ("Diagnóstico", cuerpo.get("diagnosticoTexto", ""), cuerpo.get("diagnosticoImagen")),
                    ]
                    detalle_orden = 0
                    for titulo, texto, imagen_b64 in bloques_negativa:
                        if not (texto or imagen_b64):
                            continue
                        detalle_orden += 1
                        DetalleInforme.objects.create(
                            informe=informe,
                            titulo=titulo,
                            orden=detalle_orden,
                            observacion=texto,
                            imagen=_decode_base64_imagen(imagen_b64, "detalle"),
                        )
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": f"No se pudo guardar el informe: {e}"}, status=400)

        return JsonResponse({
            "success": True,
            "informe": {"id": informe.id, "codigo": informe.codigo},
        })
