from django.db import models
from apps.Cliente.models  import Cliente



class Vehiculo(models.Model):

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='vehiculos'
    )

    numero_interno = models.CharField(
        max_length=20,
        unique=True,
        db_index=True
    )

    placa = models.CharField(
        max_length=10,
        unique=True,
        db_index=True
    )
    grupo_flota = models.ForeignKey(
       'GrupoFlota',
        on_delete=models.PROTECT,
        related_name='vehiculos_flota'
    )

    estado = models.BooleanField(
        default=True
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    fecha_actualizacion = models.DateTimeField(
        auto_now=True
    )

    def __str__(self):
        return f"{self.numero_interno} - {self.placa}"


class DispositivoDVR(models.Model):

    MAQUINA_CHOICES = [
        (1, 'Máquina 1'),
        (2, 'Máquina 2'),
    ]

    vehiculo = models.ForeignKey(
        Vehiculo,
        on_delete=models.CASCADE,
        related_name='dispositivos_dvr'
    )

    numero_maquina = models.PositiveSmallIntegerField(
        choices=MAQUINA_CHOICES
    )

    marca = models.CharField(
        max_length=100
    )

    numero_serie = models.CharField(
        max_length=100,
        blank=True
    )

    fecha_ultimo_cambio_pila = models.DateField(
        null=True,
        blank=True
    )

    fecha_actualizacion = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        unique_together = ('vehiculo', 'numero_maquina')
        ordering = ['vehiculo', 'numero_maquina']
        verbose_name = 'Dispositivo DVR'
        verbose_name_plural = 'Dispositivos DVR'

    def __str__(self):
        return f"{self.get_numero_maquina_display()} · {self.marca}"


class ConfiguracionDVR(models.Model):
    """
    Configuración global (fila única, id=1 siempre) del flujo de DVR --
    mismo patrón singleton que HorarioLaboral en apps.novedades. Por ahora
    solo el período de caducidad de la pila, administrable desde
    /administracion/sla por un usuario con administracion.gestionar_novedades.
    """

    meses_caducidad_pila = models.PositiveSmallIntegerField(default=6)

    actualizado = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_actual(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Caducidad de pila: {self.meses_caducidad_pila} meses"


class GrupoFlota(models.Model):

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='grupos_flota'
    )

    nombre_grupo = models.CharField(
        max_length=100
    )

    estado = models.BooleanField(
        default=True
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['nombre_grupo']
        verbose_name = 'Grupo de Flota'
        verbose_name_plural = 'Grupos de Flota'

    def __str__(self):
        return self.nombre_grupo
    
    
class Ruta(models.Model):

    origen = models.CharField(
        max_length=150,
        db_index=True
    )

    destino = models.CharField(
        max_length=150,
        db_index=True
    )

    estado = models.BooleanField(
        default=True
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['origen', 'destino']
        verbose_name = 'Ruta'
        verbose_name_plural = 'Rutas'

    def __str__(self):
        return f"{self.origen} → {self.destino}"