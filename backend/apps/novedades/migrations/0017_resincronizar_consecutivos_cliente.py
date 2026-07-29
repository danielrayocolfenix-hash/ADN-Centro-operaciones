import re

from django.db import migrations

PATRON_NUMERO = re.compile(r"(\d+)$")


def resincronizar(apps, schema_editor):
    """
    codigo_novedad se genera como f"N-{cliente.codigo}-{consecutivo:06d}"
    incrementando ConsecutivosCliente.consecutivo dentro de una transacción
    con select_for_update() -- en teoría no debería poder desincronizarse.
    Pero al menos un cliente real (Flota la Macarena / FLTM) tiene
    novedades ya existentes con números más altos (hasta 000006) que su
    contador guardado (3), probablemente porque esas novedades se cargaron
    con codigo_novedad ya asignado sin pasar por este contador (import de
    datos históricos). Mientras el contador siga atrás, cada intento de
    crear una novedad nueva para ese cliente choca contra un
    codigo_novedad que ya existe y falla con un error de llave duplicada.
    Se sincroniza cada contador al máximo real ya usado, para todos los
    clientes (no solo el que ya se detectó), sin bajar ninguno que ya
    estuviera bien o adelantado.
    """
    Novedades = apps.get_model("novedades", "Novedades")
    ConsecutivosCliente = apps.get_model("novedades", "ConsecutivosCliente")

    maximos_por_cliente = {}
    for cliente_id, codigo in Novedades.objects.values_list("cliente_id", "codigo_novedad"):
        match = PATRON_NUMERO.search(codigo or "")
        if not match:
            continue
        numero = int(match.group(1))
        if numero > maximos_por_cliente.get(cliente_id, 0):
            maximos_por_cliente[cliente_id] = numero

    for cliente_id, maximo_real in maximos_por_cliente.items():
        contador, _ = ConsecutivosCliente.objects.get_or_create(
            cliente_id=cliente_id, defaults={"consecutivo": maximo_real},
        )
        if contador.consecutivo < maximo_real:
            contador.consecutivo = maximo_real
            contador.save(update_fields=["consecutivo"])


def revertir(apps, schema_editor):
    # No hay forma de saber qué contadores estaban desincronizados antes --
    # no-op intencional, igual que el resto de los backfills de esta app.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("novedades", "0016_backfill_estado_novedad"),
    ]

    operations = [
        migrations.RunPython(resincronizar, revertir),
    ]
