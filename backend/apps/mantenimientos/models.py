from django.db import models
from apps.usuarios_colfenix.models import UsuariosColfenix
from apps.Vehiculo.models import Vehiculo
from apps.Vehiculo.models import GrupoFlota
from apps.Cliente.models  import Cliente

# Create your models here.
class Mantenimientos(models.Model):
    ESTADO_MANTENIMIENTO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('en_proceso', 'En Proceso'),
        ('completado', 'Completado'),
    ]

    observacion_tecnica = models.TextField(
        blank=True,
        null=True
    )

    estado_mantenimiento = models.CharField(
        max_length=20,
        choices=ESTADO_MANTENIMIENTO_CHOICES,
        default='pendiente',
        db_index=True
    )

    usuario = models.ForeignKey(
        UsuariosColfenix,
        on_delete=models.CASCADE,
        related_name='mantenimientos'
    )

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='mantenimientos'
    )

    vehiculo = models.ForeignKey(
        Vehiculo,
        on_delete=models.CASCADE,
        related_name='mantenimientos'
    )

    grupo_flota = models.ForeignKey(
        GrupoFlota,
        on_delete=models.CASCADE,
        related_name='mantenimientos'
    )

    fecha_registro = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )

    fecha_actualizacion = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        db_table = 'mantenimientos'
        verbose_name = 'Mantenimiento'
        verbose_name_plural = 'Mantenimientos'
        ordering = ['-fecha_registro']

    def __str__(self):
        return (
            f'{self.vehiculo} - '
            f'{self.get_estado_mantenimiento_display()} '
            f'({self.fecha_registro:%Y-%m-%d})'
        )

class GrupoFlota(models.Model):
    nombre_grupo = models.CharField(max_length=100, null=True)
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='grupoFlota'
    ) 
    
    def __str__(self):
        return(
            f'self.nombre_grupo'
        )
    
class DetallesMantenimiento(models.Model):
    ACCION_REALIZADA_CHOICES = [
        ('revision_general', 'Revisión General'),
        ('cambio_boton_panico', 'Cambio Botón Pánico'),
        ('reinicio_fisico_gps', 'Reinicio Físico GPS'),
        ('reprogramacion_fisica_gps', 'Reprogramación Física del GPS'),
        ('reconexion', 'Reconexión'),
        ('cambio_cableado', 'Cambio Cableado'),
        ('cambio_tecnologia_gps', 'Cambio Tecnología GPS'),
        ('cambio_tecnologia_dvr', 'Cambio Tecnología DVR'),
        ('cambio_gps', 'Cambio GPS'),
        ('cambio_simcard', 'Cambio SIMCARD'),
        ('cambio_fusible', 'Cambio Fusible'),
        ('cambio_disco_duro', 'Cambio Disco Duro'),
        ('cambio_dvr', 'Cambio de DVR'),
        ('cambio_pila', 'Cambio de Pila'),
        ('reconfiguracion_dvr', 'Reconfiguración DVR'),
        ('cambio_conector_camara', 'Cambio Conector Cámara'),
        ('cambio_camara', 'Cambio Cámara'),
        ('ajuste_camara', 'Ajuste Cámara'),
        ('ajuste_empalme_camara', 'Ajuste Empalme Cámara'),
        ('cable_en_corto', 'Cable en Corto'),
        ('reinstalacion', 'Reinstalación'),
        ('modem_sin_datos', 'Módem sin Datos'),
        ('desinstalacion', 'Desinstalación'),
        ('desmonte_dvr', 'Desmonte DVR'),
        ('instalacion_gps', 'Instalación GPS'),
        ('instalacion_video_gps', 'Instalación VIDEO-GPS'),
        ('instalacion_camara_frontal_derecha', 'Instalación Cámara Frontal Derecha'),
        ('ajuste_empalme_dvr', 'Ajuste Empalme DVR'),
        ('punto_corriente', 'Punto de Corriente'),
        ('cambio_tarjeta_secundaria', 'Cambio de Tarjeta Secundaria'),
        ('desvinculacion_online', 'Desvinculación Online'),
        ('cambio_conector', 'Cambio Conector'),
        ('cambio_dvr_gps', 'Cambio DVR y GPS'),
        ('instalacion_video', 'Instalación Video'),
        ('cambio_tecnologia_dvr_gps', 'Cambio Tecnología DVR y GPS'),
        ('cambio_punto_corriente', 'Cambio Punto Corriente'),
    ]

    mantenimiento = models.ForeignKey(
        Mantenimientos,
        on_delete=models.CASCADE,
        related_name='detalles'
    )

    elemento_revisado = models.ForeignKey(
        'Elementos',
        on_delete=models.CASCADE,
        related_name='detalles_mantenimiento'
    )

    accion_realizada = models.CharField(
        max_length=50,
        choices=ACCION_REALIZADA_CHOICES
    )

    observacion_inicial = models.TextField(
        blank=True,
        null=True
    )

    observacion = models.TextField(
        blank=True,
        null=True
    )

    class Meta:
        db_table = 'detalles_mantenimiento'
        verbose_name = 'Detalle de Mantenimiento'
        verbose_name_plural = 'Detalles de Mantenimiento'

    def __str__(self):
        return f'{self.elemento_revisado} - {self.get_accion_realizada_display()}'
    
    
class EvidenciasMantenimiento(models.Model):

    TIPO_EVIDENCIA_CHOICES = [
        ('inicial', 'Evidencia Inicial'),
        ('final', 'Evidencia Final'),
    ]

    mantenimiento = models.ForeignKey(
        Mantenimientos,
        on_delete=models.CASCADE,
        related_name='evidencias'
    )

    tipo_evidencia = models.CharField(
        max_length=10,
        choices=TIPO_EVIDENCIA_CHOICES
    )

    imagen_1 = models.ImageField(
        upload_to='mantenimientos/evidencias/'
    )

    imagen_2 = models.ImageField(
        upload_to='mantenimientos/evidencias/'
    )

    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'evidencias_mantenimiento'
        verbose_name = 'Evidencia de Mantenimiento'
        verbose_name_plural = 'Evidencias de Mantenimiento'
        
class TipoMantenimiento(models.Model):
    TIPO_MANTENIMIENTO_CHOICES = [
        ('PREVENTIVO_FISICO', 'PREVENTIVO FÍSICO'),
        ('CORRECTIVO', 'CORRECTIVO'),
        ('PREVENTIVO_ONLINE', 'PREVENTIVO ONLINE'),
        ('GENERAL', 'GENERAL'),
        ('MEJORA', 'MEJORA'),
    ]
    
    tipo_mantenimiento = models.CharField(
        max_length=20,
        choices=TIPO_MANTENIMIENTO_CHOICES,
        unique=True
    )
    
    class Meta:
        db_table = 'tipo_mantenimiento'
        verbose_name = 'Tipo de Mantenimiento'
        verbose_name_plural = 'Tipos de Mantenimiento'
        
    def __str__(self):
        return self.get_tipo_mantenimiento_display()
    
    
class Elementos (models.Model):
    nombre = models.CharField(
        max_length=200,
        unique=True
    )
    
    descripcion = models.TextField(
        blank=True,
        null=True
    )
    
    activo = models.BooleanField(
        default=True
    )
    
    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )
    
    class Meta:
        ordering = ['nombre']
    
    def __str__(self):
        return self.nombre
    