from django.contrib import admin
from .models import (
    TipoInforme,
    CategoriaTipoInforme,
    Informe,
    InformeLogiox,
    SolicitudImagen,
    InformeRecorrido,
    SegmentoAnalizado,
    TipoEvento,
    EventoInforme,
    EvidenciaEvento,
    DetalleInforme,
    PlantillaTexto,
)


@admin.register(TipoInforme)
class TipoInformeAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'categoria_informe', 'nivel_prioridad', 'tiempo_maximo_horas', 'activo')
    list_filter = ('nivel_prioridad', 'categoria_informe', 'nivel_prioridad', 'activo')
    search_fields = ('nombre',)


@admin.register(CategoriaTipoInforme)
class CategoriaTipoInformeAdmin(admin.ModelAdmin):
    list_display = ('nombre_categoria_informe', 'estado')
    list_filter = ('estado',)
    search_fields = ('nombre_categoria_informe',)


class DetalleInformeInline(admin.TabularInline):
    model = DetalleInforme
    extra = 0


class SolicitudImagenInline(admin.TabularInline):
    model = SolicitudImagen
    extra = 0


class SegmentoAnalizadoInline(admin.TabularInline):
    model = SegmentoAnalizado
    extra = 0


@admin.register(Informe)
class InformeAdmin(admin.ModelAdmin):
    list_display = ('codigo', 'novedad', 'tipo_informe', 'estado', 'resultado', 'fecha_creacion')
    list_filter = ('estado', 'resultado', 'tipo_informe')
    search_fields = ('codigo', 'novedad__codigo_novedad', 'titulo')
    readonly_fields = ('codigo',)
    inlines = [DetalleInformeInline, SolicitudImagenInline, SegmentoAnalizadoInline]


@admin.register(InformeLogiox)
class InformeLogioxAdmin(admin.ModelAdmin):
    list_display = ('informe', 'modo', 'no_aplica')
    list_filter = ('modo', 'no_aplica')


@admin.register(InformeRecorrido)
class InformeRecorridoAdmin(admin.ModelAdmin):
    list_display = ('informe', 'no_aplica')
    list_filter = ('no_aplica',)


@admin.register(SegmentoAnalizado)
class SegmentoAnalizadoAdmin(admin.ModelAdmin):
    list_display = ('informe', 'orden', 'hora_inicio', 'hora_fin')
    list_filter = ('informe',)


@admin.register(TipoEvento)
class TipoEventoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'requiere_descripcion', 'activo')
    list_filter = ('requiere_descripcion', 'activo')
    search_fields = ('nombre',)


@admin.register(EventoInforme)
class EventoInformeAdmin(admin.ModelAdmin):
    list_display = ('segmento', 'tipo', 'orden')
    list_filter = ('tipo',)


@admin.register(EvidenciaEvento)
class EvidenciaEventoAdmin(admin.ModelAdmin):
    list_display = ('evento', 'descripcion', 'orden')


@admin.register(DetalleInforme)
class DetalleInformeAdmin(admin.ModelAdmin):
    list_display = ('informe', 'titulo', 'orden', 'hora_inicio', 'hora_fin')
    list_filter = ('informe',)
    search_fields = ('titulo',)


@admin.register(PlantillaTexto)
class PlantillaTextoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo_evento', 'activo')
    list_filter = ('tipo_evento', 'activo')
    search_fields = ('nombre',)
