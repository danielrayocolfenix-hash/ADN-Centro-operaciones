from django.db import migrations

# Catálogo completo de permisos (vistas del dashboard + acciones sobre cada
# módulo). El orden define el orden de aparición en la pantalla de
# Administración › Usuarios.
#
# Antes de este cambio no existía ningún sistema de permisos: cualquier
# usuario autenticado veía y hacía todo lo que hoy es "abierto a todos" acá
# abajo, y las páginas de Administración + "Asignar analista" ya estaban
# bloqueadas para cualquiera que no fuera is_staff=True (guard en App.jsx /
# check en las vistas). Para que activar este sistema no le quite ACCESO A
# NADA que alguien ya estuviera usando, pero tampoco le REGALE de un día
# para otro capacidades administrativas nuevas a cuentas no-staff, el default
# reproduce exactamente ese estado actual: todos los usuarios activos
# reciben el bloque "abierto a todos", y el bloque "solo staff hoy" se
# otorga únicamente a quienes ya son is_staff=True (que de todas formas
# tienen bypass total vía tiene_permiso() -- se les asigna explícito acá
# solo para que la pantalla de Usuarios los muestre consistentemente).
CATALOGO_ABIERTO_A_TODOS = [
    # (clave, etiqueta, categoria, tipo)
    ("vista.dashboard", "Ver Dashboard", "Vistas", "vista"),
    ("vista.monitoreo", "Ver Monitoreo en vivo", "Vistas", "vista"),
    ("vista.clientes", "Ver Clientes", "Vistas", "vista"),
    ("vista.novedades", "Ver Novedades", "Vistas", "vista"),
    ("vista.mantenimientos", "Ver Mantenimientos", "Vistas", "vista"),
    ("vista.informes", "Ver Informes legales", "Vistas", "vista"),

    ("novedades.crear", "Registrar novedad", "Novedades", "accion"),
    ("novedades.editar", "Editar novedad / avanzar flujo DVR", "Novedades", "accion"),
    ("novedades.eliminar", "Eliminar novedad", "Novedades", "accion"),
    ("novedades.subir_evidencia", "Adjuntar evidencia", "Novedades", "accion"),
    ("novedades.exportar", "Exportar trazabilidad (CSV)", "Novedades", "accion"),
    ("novedades.generar_informe", "Generar informe desde una novedad", "Novedades", "accion"),

    ("clientes.crear", "Crear cliente", "Clientes", "accion"),
    ("clientes.editar", "Editar cliente", "Clientes", "accion"),
    ("clientes.eliminar", "Eliminar cliente", "Clientes", "accion"),

    ("mantenimientos.crear", "Crear mantenimiento", "Mantenimientos", "accion"),
    ("mantenimientos.editar", "Editar mantenimiento", "Mantenimientos", "accion"),
    ("mantenimientos.eliminar", "Eliminar mantenimiento", "Mantenimientos", "accion"),

    ("informes.crear", "Generar informe (desde Informes legales)", "Informes", "accion"),
]

CATALOGO_SOLO_STAFF_HOY = [
    ("vista.administracion_novedades", "Ver Configuración de novedades", "Vistas", "vista"),
    ("vista.administracion_metricas", "Ver Métricas de analistas", "Vistas", "vista"),
    ("vista.administracion_sitio", "Ver Configuración del sitio", "Vistas", "vista"),
    ("vista.administracion_usuarios", "Ver Usuarios y permisos", "Vistas", "vista"),

    ("novedades.asignar_analista", "Asignar analista", "Novedades", "accion"),

    ("administracion.gestionar_novedades", "Editar configuración de novedades (SLA, horario, motivos, tipos)", "Administración", "accion"),
    ("administracion.editar_sitio", "Editar identidad y opciones del topbar", "Administración", "accion"),
    ("administracion.asignar_permisos", "Asignar permisos a otros usuarios", "Administración", "accion"),
]


def sembrar_y_otorgar(apps, schema_editor):
    Permiso = apps.get_model("configuracion", "Permiso")
    UsuariosColfenix = apps.get_model("usuarios_colfenix", "UsuariosColfenix")

    abiertos, restringidos = [], []
    orden = 1
    for clave, etiqueta, categoria, tipo in CATALOGO_ABIERTO_A_TODOS:
        permiso, _ = Permiso.objects.get_or_create(
            clave=clave, defaults={"etiqueta": etiqueta, "categoria": categoria, "tipo": tipo, "orden": orden},
        )
        abiertos.append(permiso)
        orden += 1
    for clave, etiqueta, categoria, tipo in CATALOGO_SOLO_STAFF_HOY:
        permiso, _ = Permiso.objects.get_or_create(
            clave=clave, defaults={"etiqueta": etiqueta, "categoria": categoria, "tipo": tipo, "orden": orden},
        )
        restringidos.append(permiso)
        orden += 1

    for usuario in UsuariosColfenix.objects.filter(is_active=True):
        permisos = abiertos + restringidos if usuario.is_staff else abiertos
        usuario.permisos.set(permisos)


def revertir(apps, schema_editor):
    Permiso = apps.get_model("configuracion", "Permiso")
    claves = [c for c, _, _, _ in CATALOGO_ABIERTO_A_TODOS + CATALOGO_SOLO_STAFF_HOY]
    Permiso.objects.filter(clave__in=claves).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios_colfenix", "0004_usuarioscolfenix_permisos"),
        ("configuracion", "0002_permiso"),
    ]

    operations = [
        migrations.RunPython(sembrar_y_otorgar, revertir),
    ]
