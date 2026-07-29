from django.db import migrations

# Roles canónicos que ya existían como ROL_CHOICES en el modelo (para dar una
# base limpia de sugerencias) -- se suman a lo que ya haya realmente en la
# base, sin tocar ni normalizar esos valores reales (ver comentario en
# RolUsuario.Meta).
ROLES_BASE = ["Analista", "Supervisor", "Administrador"]


def sembrar(apps, schema_editor):
    RolUsuario = apps.get_model("usuarios_colfenix", "RolUsuario")
    UsuariosColfenix = apps.get_model("usuarios_colfenix", "UsuariosColfenix")

    for nombre in ROLES_BASE:
        RolUsuario.objects.get_or_create(nombre=nombre)

    roles_reales = (
        UsuariosColfenix.objects.exclude(rol="").values_list("rol", flat=True).distinct()
    )
    for nombre in roles_reales:
        RolUsuario.objects.get_or_create(nombre=nombre)


def revertir(apps, schema_editor):
    RolUsuario = apps.get_model("usuarios_colfenix", "RolUsuario")
    RolUsuario.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios_colfenix", "0007_rolusuario"),
    ]

    operations = [
        migrations.RunPython(sembrar, revertir),
    ]
