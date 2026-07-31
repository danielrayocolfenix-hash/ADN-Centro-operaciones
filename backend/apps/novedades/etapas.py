"""
Registro fijo de criterios de "completado" por etapa -- a propósito NO es un
motor de reglas: cada función es un chequeo hardcodeado sobre campos ya
existentes de Novedades. Lo único configurable desde
Administración › Configuración de novedades es la metadata en EtapaFlujo
(nombre, descripción, orden, activo); esta lógica vive acá y solo cambia con
una migración + código.

Las claves de las primeras 6 (track=ANALISTA) coinciden con las que ya
usaba `calcularPasosFlujo()` en el frontend antes de que el catálogo se
volviera configurable -- no renombrarlas sin actualizar también el espejo
en JS (NovedadDetallePage.jsx) y la migración de datos que siembra
EtapaFlujo.
"""

CRITERIOS_ETAPA = {
    "registrada": lambda n: True,
    "dvr_ingreso": lambda n: bool(n.dispositivo_dvr_id),
    "revision": lambda n: n.estado_dd in ("EN_REVISION", "TERMINADO"),
    "decision": lambda n: bool(n.respuesta_novedad),
    "informe": lambda n: n.informes.exists(),
    "salida_dvr": lambda n: bool(n.fecha_salida_dvr),
    "cliente_respuesta": lambda n: bool(n.respondido_por_cliente_id),
}
