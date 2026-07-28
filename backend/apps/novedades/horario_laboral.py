from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from apps.novedades.models import HorarioLaboral

# El horario laboral es un concepto de hora local de Colombia. settings.TIME_ZONE
# está en 'UTC', así que NO se puede usar timezone.localtime() (resuelve contra
# la zona "activa" de Django, que hoy es UTC) — se fija esta zona explícita para
# que el cálculo no dependa de esa configuración. Colombia no observa horario de
# verano, así que no hay caso de hora ambigua/duplicada con una zona fija.
ZONA_LABORAL = ZoneInfo("America/Bogota")

# 80% del SLA consumido -> "En riesgo". Es una decisión de UX (cuándo se pone
# ámbar la alerta antes de vencer), no una regla de negocio que alguien vaya a
# auditar o necesite ajustar por cliente/tipo — se deja como constante de
# código en vez de sumar un campo de configuración más.
UMBRAL_RIESGO_SLA = 0.8

SLA_ESTADO_DISPLAY = {
    "SIN_INICIAR": "Sin iniciar",
    "SIN_SLA": "Sin SLA configurado",
    "A_TIEMPO": "A tiempo",
    "EN_RIESGO": "En riesgo",
    "VENCIDO": "Vencido",
    "FINALIZADO_A_TIEMPO": "Finalizado a tiempo",
    "FINALIZADO_FUERA_DE_TIEMPO": "Finalizado fuera de tiempo",
}

# Umbral (en días de calendario, no horas hábiles) para la espera de la DVR:
# las novedades llegan por correo y se registran de inmediato, pero la DVR
# física puede tardar varios días en llegar — ese tiempo no depende del
# horario laboral del analista (el correo/transporte no "pausa" fuera de
# horario), así que se mide en tiempo corrido, con umbrales en días en vez
# de horas.
UMBRAL_ATENCION_ESPERA_DIAS = 3
UMBRAL_ALERTA_ESPERA_DIAS = 7


def horas_habiles_entre(inicio, fin, horario):
    """
    Horas hábiles (float) transcurridas entre dos datetimes tz-aware, según
    `horario` (instancia de HorarioLaboral). Recorre día a día el rango
    [inicio.date(), fin.date()] y por cada día hábil suma la intersección de
    la ventana [hora_inicio, hora_fin] de ese día con [inicio, fin], todo
    convertido a ZONA_LABORAL. Devuelve 0.0 si inicio/fin es None o fin <= inicio.
    """
    if not inicio or not fin:
        return 0.0

    inicio = inicio.astimezone(ZONA_LABORAL)
    fin = fin.astimezone(ZONA_LABORAL)
    if fin <= inicio:
        return 0.0

    dias_habiles = horario.dias_habiles_como_set()
    total = timedelta()
    dia = inicio.date()

    while dia <= fin.date():
        if dia.weekday() in dias_habiles:
            ventana_ini = datetime.combine(dia, horario.hora_inicio, tzinfo=ZONA_LABORAL)
            ventana_fin = datetime.combine(dia, horario.hora_fin, tzinfo=ZONA_LABORAL)
            solapa_ini = max(ventana_ini, inicio)
            solapa_fin = min(ventana_fin, fin)
            if solapa_fin > solapa_ini:
                total += solapa_fin - solapa_ini
        dia += timedelta(days=1)

    return round(total.total_seconds() / 3600, 2)


def _resultado(sla_horas, transcurridas, restantes, estado):
    return {
        "sla_horas": sla_horas,
        "horas_habiles_transcurridas": transcurridas,
        "horas_habiles_restantes": restantes,
        "sla_estado": estado,
        "sla_estado_display": SLA_ESTADO_DISPLAY[estado],
    }


def calcular_sla_novedad(novedad, horario=None):
    """
    Calcula el estado de SLA de una Novedad para el flujo ENCOLADO -> TERMINADO.

    `horario`: instancia de HorarioLaboral ya cargada por el caller (para
    evitar una query por fila al serializar listas); si es None, se resuelve
    aquí mismo con HorarioLaboral.get_actual().
    """
    horario = horario or HorarioLaboral.get_actual()
    sla_horas = novedad.tipo_informe.tiempo_maximo_horas if novedad.tipo_informe_id else None

    if novedad.fecha_recepcion_dd is None:
        return _resultado(sla_horas, None, None, "SIN_INICIAR")

    fin_conteo = novedad.fecha_fin_revision or timezone.now()
    transcurridas = horas_habiles_entre(novedad.fecha_recepcion_dd, fin_conteo, horario)
    cerrado = novedad.fecha_fin_revision is not None

    if sla_horas is None:
        return _resultado(sla_horas, transcurridas, None, "SIN_SLA")

    if cerrado:
        estado = "FINALIZADO_A_TIEMPO" if transcurridas <= sla_horas else "FINALIZADO_FUERA_DE_TIEMPO"
        return _resultado(sla_horas, transcurridas, None, estado)

    restantes = round(sla_horas - transcurridas, 2)
    if transcurridas >= sla_horas:
        estado = "VENCIDO"
    elif transcurridas >= sla_horas * UMBRAL_RIESGO_SLA:
        estado = "EN_RIESGO"
    else:
        estado = "A_TIEMPO"

    return _resultado(sla_horas, transcurridas, restantes, estado)


def calcular_espera_dd(novedad):
    """
    Tiempo de calendario (24/7, no horas hábiles) entre que la novedad se
    registra en el sistema (fecha_creacion, apenas llega el correo) y el
    momento en que la DVR física quedó recibida/ENCOLADA (fecha_recepcion_dd).
    Es una espera distinta al SLA de revisión (que solo corre de ENCOLADO a
    TERMINADO) — aquí se está esperando que llegue el disco duro, no
    revisando nada todavía.
    """
    inicio = novedad.fecha_creacion
    fin = novedad.fecha_recepcion_dd
    en_espera = fin is None
    fin_conteo = fin or timezone.now()

    horas = (fin_conteo - inicio).total_seconds() / 3600
    dias = horas / 24

    if dias > UMBRAL_ALERTA_ESPERA_DIAS:
        nivel = "alerta"
    elif dias > UMBRAL_ATENCION_ESPERA_DIAS:
        nivel = "atencion"
    else:
        nivel = "normal"

    return {
        "horas_espera_dd": round(horas, 2),
        "en_espera_dd": en_espera,
        "nivel_espera_dd": nivel,
    }
