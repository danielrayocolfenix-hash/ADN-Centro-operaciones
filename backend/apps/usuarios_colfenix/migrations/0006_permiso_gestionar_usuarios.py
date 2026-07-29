from django.db import migrations

CLAVE = "administracion.gestionar_usuarios"
ETIQUETA = "Crear, editar y desactivar usuarios"
CATEGORIA = "Administración"
TIPO = "accion"


def sembrar_y_otorgar(apps, schema_editor):
    Permiso = apps.get_model("configuracion", "Permiso")
    UsuariosColfenix = apps.get_model("usuarios_colfenix", "UsuariosColfenix")

    orden_max = Permiso.objects.order_by("-orden").values_list("orden", flat=True).first() or 0
    permiso, _ = Permiso.objects.get_or_create(
        clave=CLAVE, defaults={"etiqueta": ETIQUETA, "categoria": CATEGORIA, "tipo": TIPO, "orden": orden_max + 1},
    )

    # Mismo criterio que el resto de "solo staff hoy": crear/editar/
    # desactivar usuarios es una capacidad que no existía en el dashboard
    # hasta ahora, así que el default no se la regala a nadie que no fuera
    # ya is_staff (evita expandir accesos de un día para otro).
    for usuario in UsuariosColfenix.objects.filter(is_active=True, is_staff=True):
        usuario.permisos.add(permiso)


def revertir(apps, schema_editor):
    Permiso = apps.get_model("configuracion", "Permiso")
    Permiso.objects.filter(clave=CLAVE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios_colfenix", "0005_seed_permisos_otorgar_todos"),
    ]

    operations = [
        migrations.RunPython(sembrar_y_otorgar, revertir),
    ]
