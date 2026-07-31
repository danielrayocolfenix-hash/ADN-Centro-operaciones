from django.contrib import admin
from .models import ConfiguracionSitio, Permiso


@admin.register(ConfiguracionSitio)
class ConfiguracionSitioAdmin(admin.ModelAdmin):
    list_display = ('nombre_sitio', 'actualizado')


@admin.register(Permiso)
class PermisoAdmin(admin.ModelAdmin):
    list_display = ('clave', 'etiqueta', 'categoria', 'tipo', 'orden')
    list_filter = ('tipo', 'categoria')
    search_fields = ('clave', 'etiqueta')
