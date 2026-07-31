"""
Disparo de notificaciones in-app para el portal de cliente -- una función
corta por evento conocido, llamada desde el punto donde ese evento ya
ocurre en código. No hay bus de eventos ni señales de Django: son 2 casos
hoy, no vale la pena la indirección. Mismo espíritu que apps.novedades.etapas
-- nada configurable; si aparece un tercer evento, se agrega una función más
acá.
"""
from apps.novedades.models import NovedadNotificacion


def notificar_caso_en_revision(novedad):
    """
    Llamada desde NovedadDetalleView.post() cuando estado_dd pasa a
    EN_REVISION -- informa al cliente que Colfenix ya empezó a trabajar su
    caso.
    """
    NovedadNotificacion.objects.create(
        novedad=novedad,
        cliente_id=novedad.cliente_id,
        severidad="informativo",
        mensaje=f"Tu caso {novedad.codigo_novedad} entró en revisión.",
    )


def notificar_informe_generado(informe):
    """
    Llamada desde GenerarInformeView.post() una vez el informe (y todas sus
    partes) quedó guardado -- a partir de acá CRITERIOS_ETAPA['informe'] es
    True y el cliente ya puede responder.
    """
    novedad = informe.novedad
    NovedadNotificacion.objects.create(
        novedad=novedad,
        cliente_id=novedad.cliente_id,
        severidad="accion_requerida",
        mensaje=(
            f"Ya está disponible el informe de tu caso {novedad.codigo_novedad}. "
            "Ingresa para revisarlo y responder."
        ),
    )
