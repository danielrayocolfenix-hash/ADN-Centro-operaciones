import json
from datetime import date
from django.db import IntegrityError
from django.http import JsonResponse
from django.utils.dateparse import parse_date
from django.views import View
from .models import Vehiculo, DispositivoDVR, ConfiguracionDVR
from .pila import calcular_estado_pila
from apps.configuracion.permisos import tiene_permiso


def _no_autenticado():
    return JsonResponse({"success": False, "mensaje": "Debes iniciar sesión."}, status=401)


def _sin_permiso():
    return JsonResponse({"success": False, "mensaje": "No tienes permisos para esta acción."}, status=403)


def buscar_vehiculo(request):
    q = request.GET.get('q', '').strip()

    if not q:
        return JsonResponse([], safe=False)

    vehiculos = (
        Vehiculo.objects
        .filter(
            placa__icontains=q,
            estado=True
        )
        .select_related(
            'cliente',
            'grupo_flota'
        )[:5]
    )

    data = [

        {
            "id": v.id,
            "label": f"{v.placa} - {v.numero_interno}",

            # visibles
            "placa": v.placa,
            "numero_interno": v.numero_interno,
            "cliente": str(v.cliente),
            "grupo_flota": v.grupo_flota.nombre_grupo,

            # ocultos
            "vehiculo_id": v.id,
            "cliente_id": v.cliente_id,
            "grupo_flota_id": v.grupo_flota_id,
        }

        for v in vehiculos
    ]

    return JsonResponse(data, safe=False)


class AdminConfiguracionDVR(View):
    """
    Período de caducidad de la pila de las DVR (en meses) -- fila única,
    administrable desde /administracion/sla por un usuario con
    administracion.gestionar_novedades (mismo permiso que el resto de esa
    pantalla, aunque el modelo viva en Vehiculo -- mismo patrón que
    Informes.AdminTiposInformeSLA/AdminCategoriasTipoInforme).
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        config = ConfiguracionDVR.get_actual()
        return JsonResponse({"meses_caducidad_pila": config.meses_caducidad_pila})

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            config = ConfiguracionDVR.get_actual()
            if "meses_caducidad_pila" in data:
                config.meses_caducidad_pila = int(data["meses_caducidad_pila"])
            config.save()
            return JsonResponse({"success": True, "mensaje": "Configuración actualizada correctamente."})
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


def _serializar_dispositivo_dvr(d, meses_caducidad):
    return {
        "id": d.id,
        "vehiculo_id": d.vehiculo_id,
        "vehiculo": str(d.vehiculo),
        "numero_maquina": d.numero_maquina,
        "marca": d.marca,
        "numero_serie": d.numero_serie,
        "fecha_ultimo_cambio_pila": d.fecha_ultimo_cambio_pila,
        **calcular_estado_pila(d.fecha_ultimo_cambio_pila, meses_caducidad),
    }


class AdminDispositivosDVR(View):
    """
    Catálogo de dispositivos DVR (Máquina 1/2 por vehículo) -- administrable
    desde /administracion/sla por un usuario con administracion.gestionar_novedades.
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        meses_caducidad = ConfiguracionDVR.get_actual().meses_caducidad_pila
        dispositivos = DispositivoDVR.objects.select_related('vehiculo').all()
        data = [_serializar_dispositivo_dvr(d, meses_caducidad) for d in dispositivos]
        return JsonResponse(data, safe=False)

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            dispositivo = DispositivoDVR.objects.create(
                vehiculo_id=data["vehiculo_id"],
                numero_maquina=data["numero_maquina"],
                marca=data["marca"],
                numero_serie=data.get("numero_serie", ""),
                fecha_ultimo_cambio_pila=parse_date(data["fecha_ultimo_cambio_pila"]) if data.get("fecha_ultimo_cambio_pila") else None,
            )
            meses_caducidad = ConfiguracionDVR.get_actual().meses_caducidad_pila
            return JsonResponse({
                "success": True,
                "dispositivo": _serializar_dispositivo_dvr(dispositivo, meses_caducidad),
            })
        except IntegrityError:
            return JsonResponse({
                "success": False,
                "mensaje": "Ese vehículo ya tiene registrada esa máquina.",
            }, status=400)
        except KeyError as e:
            return JsonResponse({"success": False, "mensaje": f"Falta el campo {e}."}, status=400)
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class AdminDispositivoDVRDetalle(View):
    def post(self, request, dispositivo_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_novedades"):
            return _sin_permiso()
        try:
            dispositivo = DispositivoDVR.objects.get(id=dispositivo_id)
        except DispositivoDVR.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El dispositivo no existe."}, status=404)

        try:
            data = json.loads(request.body)
            for campo in ("marca", "numero_serie"):
                if campo in data:
                    setattr(dispositivo, campo, data[campo])
            if "fecha_ultimo_cambio_pila" in data:
                valor = data["fecha_ultimo_cambio_pila"]
                dispositivo.fecha_ultimo_cambio_pila = parse_date(valor) if valor else None
            dispositivo.save()
            meses_caducidad = ConfiguracionDVR.get_actual().meses_caducidad_pila
            return JsonResponse({
                "success": True,
                "dispositivo": _serializar_dispositivo_dvr(dispositivo, meses_caducidad),
            })
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)


class RegistrarCambioPila(View):
    """
    Acceso rápido para registrar que se cambió la pila de una DVR, desde el
    propio paso "DVR ingresó" del flujo de revisión de la Novedad (cuando la
    pila aparece vencida) -- a diferencia de AdminDispositivoDVRDetalle, no
    exige administracion.gestionar_novedades, solo el mismo permiso que ya
    exige el resto de ese paso (novedades.editar), para no obligar al
    analista a salir del flujo hacia Administración.
    """

    def post(self, request, dispositivo_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "novedades.editar"):
            return _sin_permiso()
        try:
            dispositivo = DispositivoDVR.objects.get(id=dispositivo_id)
        except DispositivoDVR.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El dispositivo no existe."}, status=404)

        try:
            data = json.loads(request.body) if request.body else {}
            fecha = data.get("fecha")
            dispositivo.fecha_ultimo_cambio_pila = parse_date(fecha) if fecha else date.today()
            dispositivo.save(update_fields=["fecha_ultimo_cambio_pila", "fecha_actualizacion"])
            meses_caducidad = ConfiguracionDVR.get_actual().meses_caducidad_pila
            return JsonResponse({
                "success": True,
                "dispositivo": _serializar_dispositivo_dvr(dispositivo, meses_caducidad),
            })
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)