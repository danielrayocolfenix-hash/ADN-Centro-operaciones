from django.contrib import admin
from .models import Vehiculo, GrupoFlota, Ruta, DispositivoDVR, ConfiguracionDVR


class DispositivoDVRInline(admin.TabularInline):
    model = DispositivoDVR
    extra = 0
    max_num = 2


@admin.register(Vehiculo)
class VehiculoAdmin(admin.ModelAdmin):
    list_display = ('numero_interno', 'placa', 'cliente', 'grupo_flota', 'estado')
    list_filter = ('estado', 'cliente', 'grupo_flota')
    search_fields = ('numero_interno', 'placa')
    inlines = [DispositivoDVRInline]


@admin.register(DispositivoDVR)
class DispositivoDVRAdmin(admin.ModelAdmin):
    list_display = ('vehiculo', 'numero_maquina', 'marca', 'numero_serie', 'fecha_ultimo_cambio_pila', 'fecha_actualizacion')
    list_filter = ('numero_maquina', 'marca')
    search_fields = ('vehiculo__numero_interno', 'vehiculo__placa', 'marca', 'numero_serie')


@admin.register(ConfiguracionDVR)
class ConfiguracionDVRAdmin(admin.ModelAdmin):
    list_display = ('meses_caducidad_pila', 'actualizado')


@admin.register(GrupoFlota)
class GrupoFlotaAdmin(admin.ModelAdmin):
    list_display = ('nombre_grupo', 'cliente', 'estado')
    list_filter = ('estado', 'cliente')
    search_fields = ('nombre_grupo',)


@admin.register(Ruta)
class RutaAdmin(admin.ModelAdmin):
    list_display = ('origen', 'destino', 'estado')
    list_filter = ('estado',)
    search_fields = ('origen', 'destino')
