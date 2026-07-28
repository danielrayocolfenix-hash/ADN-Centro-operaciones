# Crear con: python manage.py makemigrations novedades --empty --name backfill_nas
# y reemplazar el contenido generado por este.

from collections import Counter
from django.db import migrations


def backfill_nas(apps, schema_editor):
    Novedades = apps.get_model('novedades', 'Novedades')

    # 1. Detectar qué valores de nas están duplicados (incluye '' vacíos)
    conteo = Counter(Novedades.objects.values_list('nas', flat=True))
    valores_duplicados = {valor for valor, total in conteo.items() if total > 1}

    if not valores_duplicados:
        return

    afectados = (
        Novedades.objects
        .filter(nas__in=valores_duplicados)
        .select_related('area_solicitante', 'vehiculo', 'tipo_informe')
        .order_by('id')
    )

    print(f"\n[backfill_nas] {afectados.count()} registros con nas duplicado/vacío a corregir.")

    for novedad in afectados:
        area = novedad.area_solicitante
        vehiculo = novedad.vehiculo
        tipo_informe = novedad.tipo_informe

        # Si faltan datos para armar el nas real, usamos un identificador
        # de respaldo legible en vez de fallar la migración a mitad de camino.
        if not (area and area.abreviatura and vehiculo and tipo_informe and novedad.fecha_novedad):
            nuevo_nas = f"LEGACY-SIN-DATOS-{novedad.id:06d}"
            print(f"  [!] Novedad id={novedad.id}: faltan datos, se asigna '{nuevo_nas}'")
        else:
            consecutivo_str = f"{novedad.id:04d}"
            fecha_str = novedad.fecha_novedad.strftime('%d/%m/%Y')
            nuevo_nas = " - ".join([
                consecutivo_str,
                "NAS",
                area.abreviatura,
                consecutivo_str,
                f"Veh {vehiculo.numero_interno}",
                vehiculo.placa,
                fecha_str,
                novedad.conductor or "",
                tipo_informe.nombre,
            ])

        novedad.nas = nuevo_nas
        novedad.save(update_fields=['nas'])

    print("[backfill_nas] Listo.\n")


def noop(apps, schema_editor):
    # No hay reversa razonable para esto: no podemos recuperar los valores
    # originales de nas una vez sobrescritos.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('novedades', '0006_alter_novedades_nivel_prioridad'),  # AJUSTAR al nombre real de tu última migración aplicada
    ]

    operations = [
        migrations.RunPython(backfill_nas, noop),
    ]