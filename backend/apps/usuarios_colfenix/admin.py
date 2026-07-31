from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import UsuariosColfenix, RolUsuario


@admin.register(UsuariosColfenix)
class UsuariosColfenixAdmin(UserAdmin):
    list_display = ('username', 'get_full_name', 'rol', 'tipo', 'is_staff', 'is_active')
    list_filter = UserAdmin.list_filter + ('rol', 'tipo')
    fieldsets = UserAdmin.fieldsets + (
        ('Colfenix', {'fields': ('telefono', 'rol', 'permisos')}),
        ('Portal de cliente', {'fields': ('tipo', 'cliente')}),
    )


@admin.register(RolUsuario)
class RolUsuarioAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'fecha_creacion')
    search_fields = ('nombre',)
