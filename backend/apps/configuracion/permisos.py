# Set base que se le otorga a cualquier usuario no-staff nuevo (mismas
# claves que ya tenía "abierto a todos" cualquier cuenta antes de que
# existiera este sistema de permisos -- ver la migración de datos
# usuarios_colfenix.0005_seed_permisos_otorgar_todos, fuente de verdad
# original). Vive acá (código vivo) en vez de importarse desde la migración
# porque una migración no debe depender de código que puede cambiar después.
CLAVES_BASE_POR_DEFECTO = [
    "vista.dashboard", "vista.monitoreo", "vista.clientes", "vista.novedades",
    "vista.mantenimientos", "vista.informes",
    "novedades.crear", "novedades.editar", "novedades.eliminar",
    "novedades.subir_evidencia", "novedades.exportar", "novedades.generar_informe",
    "clientes.crear", "clientes.editar", "clientes.eliminar",
    "mantenimientos.crear", "mantenimientos.editar", "mantenimientos.eliminar",
    "informes.crear",
]


def tiene_permiso(user, clave):
    """
    True si `user` puede ejecutar la acción/ver la vista identificada por
    `clave`. is_staff siempre implica acceso total (no revisa la tabla de
    permisos), sin importar qué tenga asignado explícitamente. Cachea el set
    de claves en el propio objeto `user` para no repetir la consulta si se
    llama más de una vez dentro de la misma request.
    """
    if not user.is_authenticated:
        return False
    if user.is_staff:
        return True
    if not hasattr(user, "_permisos_claves_cache"):
        user._permisos_claves_cache = set(user.permisos.values_list("clave", flat=True))
    return clave in user._permisos_claves_cache


def claves_de(user):
    """Todas las claves de permiso que tiene `user` — el catálogo completo si
    es is_staff, o su set explícito si no."""
    from apps.configuracion.models import Permiso

    if not user.is_authenticated:
        return []
    if user.is_staff:
        return list(Permiso.objects.values_list("clave", flat=True))
    return list(user.permisos.values_list("clave", flat=True))
