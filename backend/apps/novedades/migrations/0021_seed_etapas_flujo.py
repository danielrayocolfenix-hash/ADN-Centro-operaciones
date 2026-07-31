from django.db import migrations

# clave, track, nombre, descripcion, orden -- nombre/descripcion tomados
# tal cual del texto ya afinado en NovedadDetallePage.jsx (PasoSeccion) para
# no perder esa redacción al volverla configurable.
ETAPAS_INICIALES = [
    ("registrada", "ANALISTA", "Novedad registrada",
     "Se creó el caso en el sistema y quedó a la espera de que la DVR física llegue a Colfenix.", 1),
    ("dvr_ingreso", "ANALISTA", "DVR ingresó",
     "El vehículo tiene 2 DVR físicas -- indica cuál de las 2 (Máquina 1 o 2) llegó a Colfenix para revisión.", 2),
    ("revision", "ANALISTA", "En revisión",
     "Confirma que ya empezaste a revisar físicamente la grabación de la DVR. Acá también se adjunta la evidencia del caso.", 3),
    ("decision", "ANALISTA", "Decisión tomada",
     "Registra si la revisión fue Positiva (sí hay grabación) o Negativa (no hay), con el motivo correspondiente.", 4),
    ("informe", "ANALISTA", "Informe generado",
     "Con la decisión ya tomada, genera el informe formal que se entrega al cliente con los hallazgos de la revisión.", 5),
    ("salida_dvr", "ANALISTA", "DVR salió de Colfenix",
     "Ya con el informe generado, registra la fecha en que la DVR física salió de Colfenix de vuelta al vehículo.", 6),
    ("cliente_respuesta", "CLIENTE", "Respuesta del cliente",
     "El cliente revisa el informe generado y responde si está conforme o tiene objeciones sobre el resultado.", 1),
]


def sembrar_etapas(apps, schema_editor):
    EtapaFlujo = apps.get_model('novedades', 'EtapaFlujo')
    for clave, track, nombre, descripcion, orden in ETAPAS_INICIALES:
        EtapaFlujo.objects.get_or_create(
            clave=clave,
            defaults={
                "track": track,
                "nombre": nombre,
                "descripcion": descripcion,
                "orden": orden,
            },
        )


def eliminar_etapas(apps, schema_editor):
    EtapaFlujo = apps.get_model('novedades', 'EtapaFlujo')
    EtapaFlujo.objects.filter(
        clave__in=[clave for clave, *_ in ETAPAS_INICIALES]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('novedades', '0020_etapaflujo_novedades_comentario_cliente_and_more'),
    ]

    operations = [
        migrations.RunPython(sembrar_etapas, eliminar_etapas),
    ]
