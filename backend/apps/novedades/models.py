from datetime import time
from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.utils.dateparse import parse_date
from apps.usuarios_colfenix.models import UsuariosColfenix
from apps.Cliente.models import Cliente
from apps.Cliente.models import Area
from apps.Vehiculo.models import Vehiculo
from apps.Vehiculo.models import GrupoFlota
from apps.Vehiculo.models import Ruta


class MotivoNegativo(models.Model):
    """
    Catálogo de motivos por los que una revisión de DVR resulta Negativa
    (DVR no enciende, sin grabación del día, pila dañada, etc.). Administrable
    desde /api/admin/motivos-negativa/ por un usuario con is_staff=True.
    """

    nombre = models.CharField(
        max_length=150,
        unique=True
    )

    descripcion = models.TextField(
        blank=True
    )

    activo = models.BooleanField(
        default=True
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Motivo de negativa'
        verbose_name_plural = 'Motivos de negativa'

    def __str__(self):
        return self.nombre


class MotivoPositivo(models.Model):
    """
    Catálogo de motivos por los que una revisión de DVR resulta Positiva más
    allá del caso simple ("se encuentran registros de grabación"): por
    ejemplo, cuando sí hay registros pero la DVR ya inició un proceso de
    regrabación sobre el segmento solicitado. Administrable desde
    /api/admin/motivos-positiva/ por un usuario con is_staff=True.
    """

    nombre = models.CharField(
        max_length=150,
        unique=True
    )

    descripcion = models.TextField(
        blank=True
    )

    activo = models.BooleanField(
        default=True
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Motivo de positiva'
        verbose_name_plural = 'Motivos de positiva'

    def __str__(self):
        return self.nombre


class Novedades(models.Model):

    NIVEL_PRIORIDAD = [
        ('Alta', 'Alta'),
        ('Media', 'Media'),
        ('Baja', 'Baja')
    ]

    ESTADO_DD_CHOICES = [
        ('PENDIENTE_DD', 'PENDIENTE DD'),
        ('ENCOLADO', 'ENCOLADO'),
        ('EN_REVISION', 'EN REVISION'),
        ('TERMINADO', 'TERMINADO'),
    ]

    RESPUESTAS_CHOICES = [
        ('Positiva', 'Positiva'),
        ('Negativa', 'Negativa'),
    ]

    ESTADOS_NOVEDADES_CHOICES = [
        ('Pendiente_por_responder', 'Pendiente por responder'),
        ('Completado', 'Completado'),
        ('Informacion_incompleta', 'Información incompleta'),
    ]

    codigo_novedad = models.CharField(
        max_length=100,
        unique=True,
        editable=False,
        blank=True,  # se llena en save(), no lo pide ningún form
    )

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        related_name='novedades'
    )

    vehiculo = models.ForeignKey(
        Vehiculo,
        on_delete=models.PROTECT,
        related_name='novedades'
    )

    grupo_flota = models.ForeignKey(
        GrupoFlota,
        on_delete=models.PROTECT,
        related_name='novedades'
    )

    area_solicitante = models.ForeignKey(
        Area,
        on_delete=models.PROTECT,
        related_name='novedades'
    )

    tipo_informe = models.ForeignKey(
        'Informes.TipoInforme',
        on_delete=models.PROTECT,
        related_name='novedades'
    )

    nivel_prioridad = models.CharField(
        max_length=50,
        choices=NIVEL_PRIORIDAD,
        null=True,
        editable=False
    )

    ruta = models.ForeignKey(
        Ruta,
        on_delete=models.PROTECT,
        related_name='novedades'
    )

    analista = models.ForeignKey(
        UsuariosColfenix,
        on_delete=models.PROTECT,
        related_name='novedades'
    )

    conductor = models.CharField(
        max_length=150
    )

    # CAMBIO: antes era un CharField libre que el usuario digitaba.
    # Ahora es autogenerado en save() a partir de area_solicitante,
    # vehiculo, fecha_novedad, conductor y tipo_informe.
    # unique=True porque es el identificador del informe generado.
    nas = models.CharField(
        max_length=255,
        unique=True,
        editable=False,
        blank=True,
    )

    pasajeros_reportados = models.PositiveIntegerField(
        default=0
    )

    fecha_novedad = models.DateField()

    fecha_solicitud = models.DateField()

    fecha_recepcion_dd = models.DateTimeField(
        null=True,
        blank=True
    )

    fecha_inicio_revision = models.DateTimeField(
        null=True,
        blank=True
    )

    fecha_fin_revision = models.DateTimeField(
        null=True,
        blank=True
    )

    estado_dd = models.CharField(
        max_length=20,
        choices=ESTADO_DD_CHOICES,
        default='PENDIENTE_DD'
    )

    respuesta_novedad = models.CharField(
        max_length=20,
        choices=RESPUESTAS_CHOICES,
        null=True,
        blank=True
    )

    dispositivo_dvr = models.ForeignKey(
        'Vehiculo.DispositivoDVR',
        on_delete=models.PROTECT,
        related_name='novedades',
        null=True,
        blank=True
    )

    fecha_ingreso_dvr = models.DateTimeField(
        null=True,
        blank=True,
        editable=False
    )

    fecha_salida_dvr = models.DateField(
        null=True,
        blank=True
    )

    RESPUESTA_CLIENTE_CHOICES = [
        ('Conforme', 'Conforme'),
        ('No_conforme', 'No conforme'),
    ]

    # NUEVO: respuesta del cliente sobre el informe ya generado, registrada
    # desde el portal de cliente (apps.novedades.views_portal /
    # ClienteResponderNovedad) -- es de una sola vía, no editable desde
    # NovedadDetalleView (ese endpoint es staff-only).
    respuesta_cliente = models.CharField(
        max_length=20,
        choices=RESPUESTA_CLIENTE_CHOICES,
        null=True,
        blank=True
    )

    comentario_cliente = models.TextField(
        blank=True
    )

    fecha_respuesta_cliente = models.DateTimeField(
        null=True,
        blank=True,
        editable=False
    )

    respondido_por_cliente = models.ForeignKey(
        UsuariosColfenix,
        on_delete=models.PROTECT,
        related_name='novedades_respondidas_cliente',
        null=True,
        blank=True
    )

    motivo_negativo = models.ForeignKey(
        MotivoNegativo,
        on_delete=models.PROTECT,
        related_name='novedades',
        null=True,
        blank=True
    )

    detalle_motivo_negativo = models.TextField(
        blank=True
    )

    motivo_positivo = models.ForeignKey(
        MotivoPositivo,
        on_delete=models.PROTECT,
        related_name='novedades',
        null=True,
        blank=True
    )

    detalle_motivo_positivo = models.TextField(
        blank=True
    )

    observaciones = models.TextField(
        blank=True,
        null=True
    )

    estado_novedad = models.CharField(
        max_length=100,
        choices=ESTADOS_NOVEDADES_CHOICES,
        default='Pendiente_por_responder'
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    fecha_actualizacion = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ['-fecha_creacion']
        verbose_name = 'Novedad'
        verbose_name_plural = 'Novedades'
        # NUEVO: índices para los filtros más comunes en listados/reportes
        indexes = [
            models.Index(fields=['estado_novedad']),
            models.Index(fields=['estado_dd']),
            models.Index(fields=['fecha_novedad']),
            models.Index(fields=['cliente', 'estado_novedad']),
            # Usado por sugerir_motivo() -- historial de motivos por
            # vehículo + tipo de informe, para sugerir el motivo más
            # frecuente al tomar una decisión de revisión.
            models.Index(fields=['vehiculo', 'tipo_informe']),
        ]

    def clean(self):
        """
        NUEVO: antes no había ninguna validación cruzada entre fechas.
        clean() no se llama solo — lo invocamos desde full_clean() en save().
        """
        super().clean()
        errores = {}

        if self.fecha_inicio_revision and self.fecha_fin_revision:
            if self.fecha_fin_revision < self.fecha_inicio_revision:
                errores['fecha_fin_revision'] = 'No puede ser anterior al inicio de revisión.'

        # NOTA: se quitó a propósito la validación que exigía
        # fecha_solicitud >= fecha_novedad. La solicitud a Colfenix no
        # siempre llega después de ocurrida la novedad -- a veces se
        # solicita antes de que el evento termine de reportarse, así que no
        # hay un orden fijo real entre ambas fechas.

        if self.motivo_negativo_id and self.respuesta_novedad != 'Negativa':
            errores['motivo_negativo'] = 'Solo aplica cuando la respuesta de la novedad es Negativa.'

        if self.motivo_positivo_id and self.respuesta_novedad != 'Positiva':
            errores['motivo_positivo'] = 'Solo aplica cuando la respuesta de la novedad es Positiva.'

        if errores:
            raise ValidationError(errores)

    def _validar_datos_para_identificadores(self):
        """
        NUEVO: codigo_novedad depende de cliente.codigo y nas depende de
        area_solicitante.abreviatura — ambos son null=True en sus modelos.
        Si faltan, fallamos con un mensaje claro en vez de generar un
        identificador corrupto (ej. 'N-None-000001') silenciosamente.
        """
        faltantes = []

        if not self.cliente.codigo:
            faltantes.append(f"El cliente '{self.cliente.nombre}' no tiene 'codigo' asignado.")

        if not self.area_solicitante.abreviatura:
            faltantes.append(
                f"El área '{self.area_solicitante.nombre}' no tiene 'abreviatura' asignada."
            )

        if faltantes:
            raise ValidationError({'__all__': faltantes})

    def _generar_nas(self, consecutivo_global):
        consecutivo_str = f"{consecutivo_global:04d}"

        fecha = self.fecha_novedad
        if isinstance(fecha, str):
            fecha = parse_date(fecha)
            if fecha is None:
                raise ValidationError({'fecha_novedad': 'Formato de fecha inválido, se esperaba YYYY-MM-DD.'})

        fecha_str = fecha.strftime('%d/%m/%Y')

        return " - ".join([
            consecutivo_str,
            "NAS",
            self.area_solicitante.abreviatura,
            consecutivo_str,
            f"Veh {self.vehiculo.numero_interno}",
            self.vehiculo.placa,
            fecha_str,
            self.conductor,
            self.tipo_informe.nombre,
        ])

    def save(self, *args, **kwargs):
        es_creacion = self._state.adding

        if not es_creacion:
            if self.tipo_informe_id:
                self.nivel_prioridad = self.tipo_informe.nivel_prioridad

            self.full_clean(exclude=["nas", "codigo_novedad"])
            return super().save(*args, **kwargs)

        with transaction.atomic():

            self._validar_datos_para_identificadores()

            contador, _ = ConsecutivosCliente.objects.select_for_update().get_or_create(
                cliente=self.cliente,
                defaults={"consecutivo": 0}
            )

            contador.consecutivo += 1
            contador.save(update_fields=["consecutivo"])

            self.codigo_novedad = (
                f"N-{self.cliente.codigo}-{contador.consecutivo:06d}"
            )

            consecutivo_global = Novedades.objects.count() + 1

            self.nas = self._generar_nas(consecutivo_global)

            if self.tipo_informe_id:
                self.nivel_prioridad = self.tipo_informe.nivel_prioridad

            self.full_clean(exclude=["nas", "codigo_novedad"])

            return super().save(*args, **kwargs)
        
    def __str__(self):
        return self.codigo_novedad
    
    
    
class ConsecutivosCliente(models.Model):
    cliente = models.OneToOneField(
        Cliente,
        on_delete=models.CASCADE,
        related_name='consecutivo'
    )
    consecutivo = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Consecutivo de {self.cliente.nombre}: {self.consecutivo}"


class NovedadEvento(models.Model):
    """
    Bitácora mínima de trazabilidad: una fila por cada cambio de estado_dd
    o respuesta_novedad. Alimenta el panel de "Trazabilidad" de la pantalla
    de revisión DVR — evidencia de quién y cuándo se tomó cada decisión.
    """

    novedad = models.ForeignKey(
        Novedades,
        on_delete=models.CASCADE,
        related_name='eventos'
    )

    campo = models.CharField(
        max_length=50
    )

    valor_anterior = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    valor_nuevo = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    usuario = models.ForeignKey(
        UsuariosColfenix,
        on_delete=models.SET_NULL,
        related_name='eventos_novedad',
        null=True,
        blank=True
    )

    creado = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['creado']
        verbose_name = 'Evento de novedad'
        verbose_name_plural = 'Eventos de novedad'

    def __str__(self):
        return f"{self.novedad.codigo_novedad}: {self.campo} → {self.valor_nuevo}"


class NovedadNotificacion(models.Model):
    """
    Notificación in-app para el cliente del portal: una fila por cada evento
    relevante que ocurre sobre su Novedad (el caso entra en revisión, se
    genera un informe que requiere su respuesta...) -- Centro de
    notificaciones del portal, fase inicial. A propósito NO es un motor de
    reglas configurable (mismo espíritu que EtapaFlujo/CRITERIOS_ETAPA): los
    eventos que disparan una notificación están hardcodeados en
    apps.novedades.notificaciones, llamados desde los pocos puntos del
    código donde ese evento ya ocurre. Sin canal de correo todavía -- esto
    es solo lo que se ve en la campana del portal.
    """

    SEVERIDAD_CHOICES = [
        ("informativo", "Informativo"),
        ("accion_requerida", "Acción requerida"),
    ]

    novedad = models.ForeignKey(
        Novedades,
        on_delete=models.CASCADE,
        related_name="notificaciones_cliente"
    )

    # Denormalizado desde novedad.cliente_id a propósito: el listado del
    # portal (GET /api/portal/notificaciones/) filtra por cliente en cada
    # carga y en cada ciclo de polling -- evita el join contra Novedades en
    # la consulta más frecuente de todo el portal.
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name="notificaciones"
    )

    severidad = models.CharField(
        max_length=20,
        choices=SEVERIDAD_CHOICES,
        default="informativo"
    )

    mensaje = models.CharField(
        max_length=255
    )

    leido = models.BooleanField(default=False)

    fecha_leido = models.DateTimeField(
        null=True,
        blank=True
    )

    creado = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['-creado']
        verbose_name = 'Notificación de cliente'
        verbose_name_plural = 'Notificaciones de cliente'
        indexes = [
            models.Index(fields=['cliente', 'leido']),
        ]

    def __str__(self):
        return f"{self.novedad.codigo_novedad}: {self.mensaje[:40]}"


class EtapaFlujo(models.Model):
    """
    Metadata configurable (nombre/descripción/orden/activo) de cada paso
    conocido del flujo de revisión DVR (track=ANALISTA) o del portal de
    clientes (track=CLIENTE) -- a propósito NO es un motor de reglas: la
    `clave` de cada fila debe coincidir con una de las claves fijas que ya
    tienen su lógica de "completado" escrita en código
    (apps.novedades.etapas.CRITERIOS_ETAPA, con un espejo equivalente en el
    frontend). Un administrador puede renombrar/reordenar/activar-desactivar
    una etapa conocida desde Administración › Configuración de novedades;
    no puede crear una etapa nueva con lógica propia desde esa pantalla --
    eso sigue requiriendo una migración + código.
    """

    TRACK_CHOICES = [
        ("ANALISTA", "Analista (revisión interna)"),
        ("CLIENTE", "Cliente (portal externo)"),
    ]

    clave = models.CharField(max_length=50, unique=True)

    track = models.CharField(max_length=10, choices=TRACK_CHOICES)

    nombre = models.CharField(max_length=100)

    descripcion = models.CharField(
        max_length=250,
        blank=True,
        help_text="Subtítulo mostrado bajo el nombre del paso en el asistente.",
    )

    orden = models.PositiveIntegerField(
        default=0,
        help_text="Orden de aparición dentro de su track (analista o cliente).",
    )

    activo = models.BooleanField(default=True)

    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["track", "orden"]
        verbose_name = "Etapa del flujo"
        verbose_name_plural = "Etapas del flujo"

    def clean(self):
        from apps.novedades.etapas import CRITERIOS_ETAPA
        if self.clave not in CRITERIOS_ETAPA:
            raise ValidationError({
                "clave": f"'{self.clave}' no tiene un criterio de completado registrado en apps.novedades.etapas.",
            })

    def __str__(self):
        return f"[{self.get_track_display()}] {self.nombre}"


class HorarioLaboral(models.Model):
    """
    Configuración global (fila única, id=1 siempre) del horario laboral usado
    para calcular las horas hábiles del SLA de revisión DVR (desde ENCOLADO
    hasta TERMINADO). Editable desde /api/admin/horario-laboral/ por un
    usuario is_staff=True.
    """

    lunes = models.BooleanField(default=True)
    martes = models.BooleanField(default=True)
    miercoles = models.BooleanField(default=True)
    jueves = models.BooleanField(default=True)
    viernes = models.BooleanField(default=True)
    sabado = models.BooleanField(default=False)
    domingo = models.BooleanField(default=False)

    hora_inicio = models.TimeField(default=time(8, 0))
    hora_fin = models.TimeField(default=time(18, 0))

    actualizado = models.DateTimeField(auto_now=True)

    DIAS_ORDEN = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

    class Meta:
        verbose_name = "Horario laboral"
        verbose_name_plural = "Horario laboral"

    def clean(self):
        if self.hora_fin <= self.hora_inicio:
            raise ValidationError({"hora_fin": "Debe ser posterior a la hora de inicio."})

    def save(self, *args, **kwargs):
        # Patrón singleton: siempre una sola fila, id=1.
        self.pk = 1
        self.full_clean()
        super().save(*args, **kwargs)

    def dias_habiles_como_set(self):
        """{0..6} usando date.weekday() (lunes=0 ... domingo=6)."""
        return {i for i, campo in enumerate(self.DIAS_ORDEN) if getattr(self, campo)}

    @classmethod
    def get_actual(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Horario laboral ({self.hora_inicio}–{self.hora_fin})"


class NovedadEvidencia(models.Model):
    """
    Evidencia adjunta durante la etapa de revisión DVR (capturas de los
    segmentos revisados, foto de la placa de la DVR, etc.), independiente
    de la evidencia que luego se organiza dentro de un Informe ya generado.
    """

    novedad = models.ForeignKey(
        Novedades,
        on_delete=models.CASCADE,
        related_name='evidencias'
    )

    archivo = models.FileField(
        upload_to='novedades/evidencia/'
    )

    descripcion = models.CharField(
        max_length=200,
        blank=True
    )

    creado = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['creado']
        verbose_name = 'Evidencia de novedad'
        verbose_name_plural = 'Evidencias de novedad'

    def __str__(self):
        return f"Evidencia de {self.novedad.codigo_novedad} ({self.creado:%Y-%m-%d})"