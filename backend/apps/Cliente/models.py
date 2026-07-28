from django.db import models

# Create your models here.

class Cliente(models.Model):

    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('INACTIVO', 'Inactivo')
    ]

    nit = models.CharField(
        max_length=20,
        unique=True,
        db_index=True
    )
    codigo = models.CharField(
        max_length=10,
        unique=True,
        null=True
    )

    nombre = models.CharField(
        max_length=200,
        db_index=True
    )

    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default='ACTIVO',
        db_index=True
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    fecha_actualizacion = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clientes'

    def __str__(self):
        return f"{self.nombre}"
    
class Area(models.Model):

    ESTADO_CHOICES = [
        ('ACTIVO', 'Activo'),
        ('INACTIVO', 'Inactivo')
    ]

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='areas'
    )
    abreviatura = models.CharField(
        max_length=10,
        unique=True,
        null=True
    )

    nombre = models.CharField(
        max_length=150
    )

    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default='ACTIVO'
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['nombre']
        verbose_name = 'Área'
        verbose_name_plural = 'Áreas'
        unique_together = ('cliente', 'nombre')

    def __str__(self):
        return self.nombre