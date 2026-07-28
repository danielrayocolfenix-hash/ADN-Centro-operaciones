from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import UsuariosColfenix


@admin.register(UsuariosColfenix)
class UsuariosColfenixAdmin(UserAdmin):
    list_display = ('username', 'get_full_name', 'rol', 'is_staff', 'is_active')
    list_filter = UserAdmin.list_filter + ('rol',)
    fieldsets = UserAdmin.fieldsets + (
        ('Colfenix', {'fields': ('telefono', 'rol')}),
    )
