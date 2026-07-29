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

    # Permisos específicos (vistas/acciones del dashboard) asignados desde
    # Administración › Usuarios. Se ignora por completo si is_staff=True: un
    # usuario staff siempre tiene acceso total, sin importar qué tenga (o no)
    # asignado acá — ver apps.configuracion.permisos.tiene_permiso().
    permisos = models.ManyToManyField(
        "configuracion.Permiso",
        blank=True,
        related_name="usuarios",
    )

    class Meta:
       db_table= 'usuarios_colfenix'

    def __str__(self):
        return self.get_full_name() or self.username


class RolUsuario(models.Model):
    """
    Catálogo de roles ya usados -- alimenta el campo híbrido de rol en
    Administración › Usuarios (select con sugerencias + puede escribirse uno
    nuevo). `UsuariosColfenix.rol` sigue siendo texto libre a propósito (no
    se convirtió en FK): así no hay que tocar los filtros existentes
    `rol__icontains=...` en toda la app. Este catálogo solo alimenta el
    autocompletado -- al crear/editar un usuario con un rol que no está acá
    todavía, se agrega solo (get_or_create), sin paso extra.
    """

    nombre = models.CharField(max_length=100, unique=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre