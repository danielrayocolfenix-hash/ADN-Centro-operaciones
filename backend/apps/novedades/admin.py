from django.contrib import admin
from .models import (
    MotivoNegativo,
    MotivoPositivo,
    Novedades,
    ConsecutivosCliente,
    NovedadEvento,
    HorarioLaboral,
    NovedadEvidencia,
)


@admin.register(Novedades)
class NovedadesAdmin(admin.ModelAdmin):
    list_display = (
        'codigo_novedad', 'nas', 'cliente', 'vehiculo', 'conductor',
        'estado_dd', 'estado_novedad', 'respuesta_novedad', 'fecha_novedad',
    )
    list_filter = ('estado_dd', 'estado_novedad', 'respuesta_novedad', 'nivel_prioridad', 'cliente')
    search_fields = ('codigo_novedad', 'nas', 'conductor', 'vehiculo__numero_interno', 'vehiculo__placa')
    readonly_fields = ('codigo_novedad', 'nas', 'nivel_prioridad', 'fecha_creacion', 'fecha_actualizacion')


@admin.register(ConsecutivosCliente)
class ConsecutivosClienteAdmin(admin.ModelAdmin):
    list_display = ('cliente', 'consecutivo')
    search_fields = ('cliente__nombre',)


@admin.register(HorarioLaboral)
class HorarioLaboralAdmin(admin.ModelAdmin):
    list_display = ('hora_inicio', 'hora_fin', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo')


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
