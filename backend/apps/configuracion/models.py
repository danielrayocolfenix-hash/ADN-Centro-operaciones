from django.db import models


class ConfiguracionSitio(models.Model):
    """
    Configuración global del sitio (marca + qué se muestra en el topbar) —
    singleton (pk=1 forzado en save(), igual que HorarioLaboral en
    apps.novedades), administrable desde /administracion/sitio por un
    usuario is_staff=True, pero leída por cualquier usuario autenticado
    porque Sidebar/Topbar la necesitan para renderizarse.
    """

    nombre_sitio = models.CharField(max_length=100, default="COLFENIX GPS")
    descripcion_sidebar = models.CharField(
        max_length=150,
        blank=True,
        default="Centro de operaciones",
        help_text="Subtítulo bajo el nombre del sitio, en el logo del sidebar.",
    )
    logo = models.ImageField(upload_to="configuracion/", blank=True, null=True)

    # Booleanos explícitos (no JSONField) porque mapean 1:1 a checkboxes en
    # el frontend, igual que HorarioLaboral.
    mostrar_reloj_topbar = models.BooleanField(default=True)
    mostrar_tema_topbar = models.BooleanField(default=True)
    mostrar_alertas_topbar = models.BooleanField(default=True)
    mostrar_estado_sistema_topbar = models.BooleanField(default=True)

    actualizado = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_actual(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.nombre_sitio


class Permiso(models.Model):
    """
    Catálogo de permisos asignables (vistas del dashboard + acciones sobre
    cada módulo) — administrable desde /administracion/usuarios por un
    usuario is_staff=True. El catálogo en sí (qué permisos existen) vive en
    código/datos vía migración, no es editable desde la UI; lo único que se
    asigna por usuario es cuáles de estos permisos tiene (ver
    UsuariosColfenix.permisos). is_staff=True siempre implica todos los
    permisos, sin importar lo que tenga asignado explícitamente.
    """

    TIPOS = [("vista", "Vista"), ("accion", "Acción")]

    clave = models.CharField(max_length=100, unique=True)
    etiqueta = models.CharField(max_length=150)
    categoria = models.CharField(max_length=100)
    tipo = models.CharField(max_length=10, choices=TIPOS)
    orden = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["orden", "categoria", "etiqueta"]

    def __str__(self):
        return self.clave
