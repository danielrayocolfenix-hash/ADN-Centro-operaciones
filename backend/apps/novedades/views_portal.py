"""
Endpoints de lectura para el portal de cliente -- separados de views.py a
propósito: el serializer acá es un recorte deliberado de _serializar_novedad
(sin analista, observaciones, motivos internos, métricas de SLA ni
timestamps internos de Colfenix) y no debe poder mezclarse por accidente con
el serializer interno completo que usa el staff.

El endpoint de escritura (ClienteResponderNovedad, POST para registrar la
respuesta) vive en views.py junto a Novedades/NovedadEvento/CRITERIOS_ETAPA,
que ya necesita importados.
"""
import json
from django.http import JsonResponse
from django.views import View
from django.utils import timezone
from apps.novedades.models import Novedades, NovedadNotificacion
from apps.novedades.etapas import CRITERIOS_ETAPA
from apps.configuracion.permisos import es_cliente_de


def _no_autenticado():
    return JsonResponse({"success": False, "mensaje": "Debes iniciar sesión."}, status=401)


def _sin_permiso():
    return JsonResponse({"success": False, "mensaje": "No tienes permisos para esta acción."}, status=403)


def _serializar_novedad_portal(n):
    ultimo_informe = n.informes.order_by('-fecha_creacion').first()
    return {
        "id": n.id,
        "codigo_novedad": n.codigo_novedad,
        "vehiculo": n.vehiculo.placa,
        "numero_interno": n.vehiculo.numero_interno,
        "grupo_flota": n.vehiculo.grupo_flota.nombre_grupo,
        "conductor": n.conductor,
        "ruta": n.ruta.origen + " ➡️ " + n.ruta.destino,
        "categoria_informe": n.tipo_informe.categoria_informe.nombre_categoria_informe,
        "tipo_informe": n.tipo_informe.nombre,
        "fecha_novedad": n.fecha_novedad,
        "fecha_solicitud": n.fecha_solicitud,
        "estado_dd_display": n.get_estado_dd_display(),
        "respuesta_novedad": n.respuesta_novedad,
        "tiene_informe": ultimo_informe is not None,
        "informe": {
            "id": ultimo_informe.id,
            "codigo": ultimo_informe.codigo,
            "resultado": ultimo_informe.resultado,
            "fecha_creacion": ultimo_informe.fecha_creacion,
        } if ultimo_informe else None,
        "fecha_salida_dvr": n.fecha_salida_dvr,
        "respuesta_cliente": n.respuesta_cliente,
        "comentario_cliente": n.comentario_cliente,
        "fecha_respuesta_cliente": n.fecha_respuesta_cliente,
        "puede_responder": CRITERIOS_ETAPA["informe"](n) and not n.respuesta_cliente,
    }


def portal_listar_novedades(request):
    if not request.user.is_authenticated:
        return _no_autenticado()
    if getattr(request.user, "tipo", "STAFF") != "CLIENTE" or not request.user.cliente_id:
        return _sin_permiso()
    novedades = (
        Novedades.objects
        .filter(cliente_id=request.user.cliente_id)
        .select_related('vehiculo', 'ruta', 'tipo_informe', 'tipo_informe__categoria_informe', 'grupo_flota')
        .prefetch_related('informes')
    )
    return JsonResponse([_serializar_novedad_portal(n) for n in novedades], safe=False)


class PortalNovedadDetalle(View):
    def get(self, request, novedad_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        try:
            novedad = Novedades.objects.select_related(
                'vehiculo', 'ruta', 'tipo_informe', 'tipo_informe__categoria_informe','grupo_flota',
            ).get(id=novedad_id)
        except Novedades.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "La novedad no existe."}, status=404)
        if not es_cliente_de(request.user, novedad):
            return _sin_permiso()
        return JsonResponse(_serializar_novedad_portal(novedad))


def _serializar_notificacion(n):
    return {
        "id": n.id,
        "novedad_id": n.novedad_id,
        "codigo_novedad": n.novedad.codigo_novedad,
        "severidad": n.severidad,
        "mensaje": n.mensaje,
        "leido": n.leido,
        "creado": n.creado,
    }


def portal_listar_notificaciones(request):
    """
    GET /api/portal/notificaciones/ -- últimas notificaciones del cliente
    autenticado (más recientes primero) + conteo de no leídas, para la
    campana y el panel del portal. A diferencia de portal_listar_novedades,
    filtra directo por cliente_id (denormalizado en NovedadNotificacion) sin
    pasar por es_cliente_de -- acá no hay una Novedad puntual que validar,
    es el buzón completo del cliente.
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    if getattr(request.user, "tipo", "STAFF") != "CLIENTE" or not request.user.cliente_id:
        return _sin_permiso()

    notificaciones = (
        NovedadNotificacion.objects
        .filter(cliente_id=request.user.cliente_id)
        .select_related('novedad')[:50]
    )
    return JsonResponse({
        "no_leidas": NovedadNotificacion.objects.filter(
            cliente_id=request.user.cliente_id, leido=False
        ).count(),
        "resultados": [_serializar_notificacion(n) for n in notificaciones],
    })


class PortalMarcarNotificacionesLeidas(View):
    """
    POST /api/portal/notificaciones/marcar-leidas/ -- body opcional
    {"id": <int>} para marcar solo esa notificación; sin body (o {}) marca
    todas las no leídas del cliente. No existe "marcar como no leída" -- de
    una sola vía, igual que el resto de acciones del portal.
    """

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if getattr(request.user, "tipo", "STAFF") != "CLIENTE" or not request.user.cliente_id:
            return _sin_permiso()
        try:
            data = json.loads(request.body) if request.body else {}
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)

        qs = NovedadNotificacion.objects.filter(cliente_id=request.user.cliente_id, leido=False)
        notificacion_id = data.get("id")
        if notificacion_id:
            qs = qs.filter(id=notificacion_id)

        actualizadas = qs.update(leido=True, fecha_leido=timezone.now())
        return JsonResponse({"success": True, "actualizadas": actualizadas})
