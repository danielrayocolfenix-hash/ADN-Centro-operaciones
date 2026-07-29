from calendar import monthrange
from datetime import date


def _sumar_meses(fecha, meses):
    mes_total = fecha.month - 1 + meses
    anio = fecha.year + mes_total // 12
    mes = mes_total % 12 + 1
    dia = min(fecha.day, monthrange(anio, mes)[1])
    return date(anio, mes, dia)


def calcular_estado_pila(fecha_ultimo_cambio, meses_caducidad):
    """
    sin_registro -- nunca se registró un cambio de pila.
    vigente      -- faltan más de 30 días para la caducidad.
    por_vencer   -- caduca en 30 días o menos.
    vencida      -- ya pasó la fecha de caducidad -- cambio urgente.
    """
    if not fecha_ultimo_cambio:
        return {
            "proxima_fecha": None,
            "dias_restantes": None,
            "dias_vencida": None,
            "estado": "sin_registro",
        }

    proxima_fecha = _sumar_meses(fecha_ultimo_cambio, meses_caducidad)
    dias_restantes = (proxima_fecha - date.today()).days

    if dias_restantes < 0:
        estado = "vencida"
        dias_vencida = abs(dias_restantes)
    else:
        dias_vencida = 0
        if dias_restantes <= 30:
            estado = "por_vencer"
        else:
            estado = "vigente"

    return {
        "proxima_fecha": proxima_fecha,
        "dias_restantes": dias_restantes,
        "dias_vencida": dias_vencida,
        "estado": estado,
    }