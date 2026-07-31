from django.contrib import admin
from .models import Cliente, Area


class AreaInline(admin.TabularInline):
    model = Area
    extra = 0


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'nit', 'codigo', 'estado', 'fecha_creacion')
    list_filter = ('estado',)
    search_fields = ('nombre', 'nit', 'codigo')
    inlines = [AreaInline]


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'abreviatura', 'cliente', 'estado')
    list_filter = ('estado', 'cliente')
    search_fields = ('nombre', 'abreviatura')
