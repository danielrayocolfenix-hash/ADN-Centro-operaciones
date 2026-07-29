from django.views import View
from django.http import JsonResponse

from apps.configuracion.models import ConfiguracionSitio
from apps.configuracion.permisos import tiene_permiso

CAMPOS_BOOLEANOS = [
    "mostrar_reloj_topbar",
    "mostrar_tema_topbar",
    "mostrar_alertas_topbar",
    "mostrar_estado_sistema_topbar",
]


def _no_autenticado():
    return JsonResponse({"success": False, "mensaje": "Debes iniciar sesión."}, status=401)


def _sin_permiso():
    return JsonResponse({"success": False, "mensaje": "No tienes permisos para esta acción."}, status=403)


def _serializar_configuracion(config):
    return {
        "nombre_sitio": config.nombre_sitio,
        "descripcion_sidebar": config.descripcion_sidebar,
        "logo": config.logo.url if config.logo else None,
        "mostrar_reloj_topbar": config.mostrar_reloj_topbar,
        "mostrar_tema_topbar": config.mostrar_tema_topbar,
        "mostrar_alertas_topbar": config.mostrar_alertas_topbar,
        "mostrar_estado_sistema_topbar": config.mostrar_estado_sistema_topbar,
    }


def configuracion_sitio(request):
    """
    GET /api/configuracion-sitio/ — cualquier usuario autenticado (Sidebar y
    Topbar la consultan al cargar el dashboard, no solo el staff que la
    edita).
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    return JsonResponse(_serializar_configuracion(ConfiguracionSitio.get_actual()))


class AdminConfiguracionSitio(View):
    """
    POST /api/admin/configuracion-sitio/ — staff-only. Multipart siempre
    (aunque no se suba logo nuevo) para poder incluir el archivo del logo en
    la misma petición que el resto de campos, igual que EvidenciaNovedad.
    """

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.editar_sitio"):
            return _sin_permiso()

        config = ConfiguracionSitio.get_actual()
        try:
            if "nombre_sitio" in request.POST:
                nuevo_nombre = request.POST["nombre_sitio"].strip()
                if nuevo_nombre:
                    config.nombre_sitio = nuevo_nombre
            if "descripcion_sidebar" in request.POST:
                config.descripcion_sidebar = request.POST["descripcion_sidebar"].strip()

            for campo in CAMPOS_BOOLEANOS:
                if campo in request.POST:
                    setattr(config, campo, request.POST[campo] in ("true", "1", "True"))

            if request.FILES.get("logo"):
                config.logo = request.FILES["logo"]
            elif request.POST.get("quitar_logo") == "true" and config.logo:
                config.logo.delete(save=False)
                config.logo = None

            config.full_clean()
            config.save()
        except Exception as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)

        return JsonResponse({"success": True, "configuracion": _serializar_configuracion(config)})
