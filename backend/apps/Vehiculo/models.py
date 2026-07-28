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