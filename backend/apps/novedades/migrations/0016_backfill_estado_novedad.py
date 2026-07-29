from django.db import migrations


def backfill(apps, schema_editor):
    Novedades = apps.get_model("novedades", "Novedades")
    # Nada movía nunca estado_novedad de su default 'Pendiente_por_responder'
    # (ver el fix en NovedadDetalleView.post()), así que cualquier novedad
    # que ya tenga una respuesta real (Positiva/Negativa) quedó "atascada"
    # ahí, aunque su revisión de DVR esté terminada -- eso le ocultaba el
    # botón "Generar informe" en la tabla y la contaba como pendiente en el
    # dashboard/métricas. Se corrige una sola vez para los datos que ya
    # existen; de acá en adelante el fix en la vista lo mantiene al día.
    Novedades.objects.filter(
        estado_novedad="Pendiente_por_responder",
    ).exclude(respuesta_novedad__isnull=True).exclude(respuesta_novedad="").update(
        estado_novedad="Completado",
    )


def revertir(apps, schema_editor):
    # No hay forma confiable de distinguir estas filas de otras que ya
    # estuvieran en 'Completado' por otro motivo -- no-op intencional,
    # igual que el resto de los backfills de esta app.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("novedades", "0015_seed_motivos_positivos"),
    ]

    operations = [
        migrations.RunPython(backfill, revertir),
    ]
