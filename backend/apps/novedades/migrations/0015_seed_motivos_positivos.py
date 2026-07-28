# Siembra los motivos de positiva iniciales, con los 2 casos reales descritos
# al construir esta funcionalidad: el caso simple (se encuentran registros) y
# el caso especial de regrabación (sí hay registros, pero la DVR ya inició un
# proceso de regrabación sobre el segmento solicitado).

from django.db import migrations

MOTIVOS_INICIALES = [
    (
        "Se encuentran registros de grabación",
        "Caso estándar: la DVR cuenta con los registros de grabación solicitados para el segmento y fecha requeridos.",
    ),
    (
        "DVR inició proceso de regrabación",
        "Sí existían registros del segmento solicitado, pero la DVR ya inició un proceso de regrabación (sobrescritura) antes de poder extraerlos por completo.",
    ),
]


def sembrar_motivos(apps, schema_editor):
    MotivoPositivo = apps.get_model('novedades', 'MotivoPositivo')
    for nombre, descripcion in MOTIVOS_INICIALES:
        MotivoPositivo.objects.get_or_create(
            nombre=nombre,
            defaults={"descripcion": descripcion},
        )


def eliminar_motivos(apps, schema_editor):
    MotivoPositivo = apps.get_model('novedades', 'MotivoPositivo')
    MotivoPositivo.objects.filter(
        nombre__in=[nombre for nombre, _ in MOTIVOS_INICIALES]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('novedades', '0014_motivopositivo_novedades_detalle_motivo_positivo_and_more'),
    ]

    operations = [
        migrations.RunPython(sembrar_motivos, eliminar_motivos),
    ]
