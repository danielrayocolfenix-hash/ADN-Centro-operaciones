from django.contrib import admin
from .models import MotivoNegativo, MotivoPositivo, NovedadEvento, NovedadEvidencia


@admin.register(MotivoNegativo)
class MotivoNegativoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo', 'fecha_creacion')
    list_filter = ('activo',)
    search_fields = ('nombre',)


@admin.register(MotivoPositivo)
class MotivoPositivoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo', 'fecha_creacion')
    list_filter = ('activo',)
    search_fields = ('nombre',)


@admin.register(NovedadEvento)
class NovedadEventoAdmin(admin.ModelAdmin):
    list_display = ('novedad', 'campo', 'valor_anterior', 'valor_nuevo', 'usuario', 'creado')
    list_filter = ('campo',)
    readonly_fields = ('creado',)


@admin.register(NovedadEvidencia)
class NovedadEvidenciaAdmin(admin.ModelAdmin):
    list_display = ('novedad', 'descripcion', 'creado')
    readonly_fields = ('creado',)
