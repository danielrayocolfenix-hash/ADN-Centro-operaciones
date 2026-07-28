from django.contrib import admin
from .models import TipoInforme, CategoriaTipoInforme, Informe, DetalleInforme, EvidenciaEvento

@admin.register(TipoInforme)
class TipoInformeAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'categoria_informe', 'nivel_prioridad', 'tiempo_maximo_horas', 'activo')
    list_filter = ('nivel_prioridad', 'categoria_informe', 'nivel_prioridad', 'activo')
    search_fields = ('nombre',)