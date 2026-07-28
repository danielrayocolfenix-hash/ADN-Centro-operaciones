from django.db import models
from django.contrib.auth.models import AbstractUser

# Create your models here.
class UsuariosColfenix(AbstractUser):

    # NUEVO: antes "rol" era texto libre sin ningún valor canónico (ya
    # existían usuarios reales con "ANALISTA", "Analista de medios" y "" —
    # por eso los filtros por rol en el backend usan icontains en vez de una
    # igualdad exacta, para no dejar fuera esos valores ya existentes).
    # Estos choices son solo para que la carga de roles nuevos (vía
    # /admin/) sea consistente hacia adelante; no migran datos existentes.
    ROL_CHOICES = [
        ("analista", "Analista"),
        ("supervisor", "Supervisor"),
        ("administrador", "Administrador"),
    ]

    telefono = models.CharField(
        max_length=100,
        null=True
    )
    rol = models.CharField(
        max_length=250,
        blank=True,
        choices=ROL_CHOICES,
    )

    class Meta:
       db_table= 'usuarios_colfenix'

    def __str__(self):
        return self.get_full_name() or self.username