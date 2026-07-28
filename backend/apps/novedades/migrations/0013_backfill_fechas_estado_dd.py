# Backfill de las 3 fechas de etapa (fecha_recepcion_dd/fecha_inicio_revision/
# fecha_fin_revision) para novedades ya existentes, que hasta ahora nunca se
# llenaban solas. Usa el historial real ya registrado en NovedadEvento
# (campo='estado_dd') y, para las novedades creadas directo en un estado
# avanzado (sin NovedadEvento de esa transición), usa fecha_creacion como
# mejor aproximación disponible.

from django.db import migrations

CAMPO_TIMESTAMP_POR_ESTADO = {
    "ENCOLADO": "fecha_recepcion_dd",
    "EN_REVISION": "fecha_inicio_revision",
    "TERMINADO": "fecha_fin_revision",
}
ORDEN_ESTADO_DD = ["PENDIENTE_DD", "ENCOLADO", "EN_REVISION", "TERMINADO"]


def backfill_fechas(apps, schema_editor):
    Novedades = apps.get_model("novedades", "Novedades")
    NovedadEvento = apps.get_model("novedades", "NovedadEvento")

    # Paso 1: usar el NovedadEvento más antiguo por transición (historial real).
    for estado_valor, campo in CAMPO_TIMESTAMP_POR_ESTADO.items():
        eventos = (
            NovedadEvento.objects
            .filter(campo="estado_dd", valor_nuevo=estado_valor)
            .order_by("novedad_id", "creado")
        )
        vistos = set()
        for ev in eventos:
            if ev.novedad_id in vistos:
                continue
            vistos.add(ev.novedad_id)
            Novedades.objects.filter(
                id=ev.novedad_id, **{f"{campo}__isnull": True}
            ).update(**{campo: ev.creado})

    # Paso 2: fallback — novedades ya en un estado != PENDIENTE_DD sin ningún
    # NovedadEvento de estado_dd (creadas directamente en ese estado antes de
    # este cambio). fecha_creacion es la mejor aproximación disponible.
    novedades = Novedades.objects.exclude(estado_dd="PENDIENTE_DD").only(
        "id", "estado_dd", "fecha_creacion",
        "fecha_recepcion_dd", "fecha_inicio_revision", "fecha_fin_revision",
    )
    for novedad in novedades:
        idx_actual = ORDEN_ESTADO_DD.index(novedad.estado_dd)
        faltantes = {
            campo: novedad.fecha_creacion
            for estado, campo in CAMPO_TIMESTAMP_POR_ESTADO.items()
            if ORDEN_ESTADO_DD.index(estado) <= idx_actual and getattr(novedad, campo) is None
        }
        if faltantes:
            Novedades.objects.filter(id=novedad.id).update(**faltantes)


def sin_reversa(apps, schema_editor):
    # Irreversible a propósito: no se puede distinguir de forma confiable una
    # fecha real ya usada en producción de una puesta por este backfill.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("novedades", "0012_horariolaboral"),
    ]

    operations = [
        migrations.RunPython(backfill_fechas, sin_reversa),
    ]
