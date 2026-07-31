from django.contrib import admin
from .models import (
    Mantenimientos,
    GrupoFlota,
    DetallesMantenimiento,
    EvidenciasMantenimiento,
    TipoMantenimiento,
    Elementos,
)


class DetallesMantenimientoInline(admin.TabularInline):
    model = DetallesMantenimiento
    extra = 0


class EvidenciasMantenimientoInline(admin.TabularInline):
    model = EvidenciasMantenimiento
    extra = 0


@admin.register(Mantenimientos)
class MantenimientosAdmin(admin.ModelAdmin):
    list_display = ('vehiculo', 'cliente', 'estado_mantenimiento', 'usuario', 'fecha_registro')
    list_filter = ('estado_mantenimiento', 'cliente', 'grupo_flota')
    search_fields = ('vehiculo__numero_interno', 'vehiculo__placa', 'observacion_tecnica')
    inlines = [DetallesMantenimientoInline, EvidenciasMantenimientoInline]


@admin.register(GrupoFlota)
class GrupoFlotaMantenimientoAdmin(admin.ModelAdmin):
    list_display = ('nombre_grupo', 'cliente')
    list_filter = ('cliente',)
    search_fields = ('nombre_grupo',)


@admin.register(TipoMantenimiento)
class TipoMantenimientoAdmin(admin.ModelAdmin):
    list_display = ('tipo_mantenimiento',)


@admin.register(Elementos)
class ElementosAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo', 'fecha_creacion')
    list_filter = ('activo',)
    search_fields = ('nombre',)
