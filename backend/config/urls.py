"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path
from apps.novedades.views import novedades_view
from apps.novedades.views import CrearNovedad
from apps.novedades.views import NovedadDetalleView
from apps.novedades.views import get_csrf_token
from apps.novedades.views import listar_ruta
from apps.novedades.views import formulario_novedades
from apps.Vehiculo.views import buscar_vehiculo
from apps.Cliente.views import listar_areas_solicitantes
from apps.Informes.views import formulario_informes
from apps.novedades.views import categorias_tipos_informe
from apps.novedades.views import count_novedades_hoy
from apps.novedades.views import count_informes_pendientes
from apps.Informes.views import listar_tipoInforme
from apps.novedades.views import EliminarNovedad
from apps.novedades.views import listar_eventos_novedad
from apps.novedades.views import EvidenciaNovedad
from apps.novedades.views import EliminarEvidenciaNovedad
from apps.novedades.views import listar_motivos_negativa
from apps.novedades.views import AdminMotivosNegativa
from apps.novedades.views import AdminMotivoNegativoDetalle
from apps.novedades.views import CrearMotivoNegativoRapido
from apps.novedades.views import listar_motivos_positiva
from apps.novedades.views import AdminMotivosPositiva
from apps.novedades.views import AdminMotivoPositivoDetalle
from apps.novedades.views import CrearMotivoPositivoRapido
from apps.novedades.views import AdminHorarioLaboral
from apps.novedades.views import AsignarAnalista
from apps.novedades.views import metricas_analistas
from apps.usuarios_colfenix.views import LoginView, LogoutView, me
from apps.usuarios_colfenix.views import listar_analistas
from apps.usuarios_colfenix.views import AdminUsuarios
from apps.usuarios_colfenix.views import AdminUsuarioDetalle
from apps.usuarios_colfenix.views import listar_permisos_catalogo
from apps.usuarios_colfenix.views import listar_roles_catalogo
from apps.usuarios_colfenix.views import AdminPermisosUsuario
from apps.Informes.views import GenerarInformeView
from apps.Informes.views import listar_informes
from apps.Informes.views import InformeDetalleCompleto
from apps.Informes.views import AdminTiposInformeSLA
from apps.Informes.views import AdminTipoInformeSLADetalle
from apps.Informes.views import AdminCategoriasTipoInforme
from apps.Informes.views import AdminInformeDetalle
from apps.configuracion.views import configuracion_sitio
from apps.configuracion.views import AdminConfiguracionSitio

urlpatterns = [
    path('api/auth/login/', LoginView.as_view(), name='auth-login'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('api/auth/me/', me, name='auth-me'),
    path('admin/', admin.site.urls),
    path('api/csrf/', get_csrf_token, name='get-csrf-token'),
    path('api/novedades/', novedades_view, name='novedades'),
    path('api/formulario/novedades/', formulario_novedades, name='formulario_novedades' ),
    path('api/crear-novedad/', CrearNovedad.as_view(), name='crear-novedad'),
    path('api/novedades/<int:novedad_id>/', NovedadDetalleView.as_view(), name='detalle-novedad'),
    path('api/novedades/<int:novedad_id>/eliminar/', EliminarNovedad.as_view(), name='eliminar-novedad'),
    path('api/novedades/<int:novedad_id>/eventos/', listar_eventos_novedad, name='eventos-novedad'),
    path('api/novedades/<int:novedad_id>/evidencia/', EvidenciaNovedad.as_view(), name='evidencia-novedad'),
    path('api/novedades/evidencia/<int:evidencia_id>/eliminar/', EliminarEvidenciaNovedad.as_view(), name='eliminar-evidencia-novedad'),
    path('api/novedades/<int:novedad_id>/generar-informe/', GenerarInformeView.as_view(), name='generar-informe'),
    path('api/novedades/count/', count_novedades_hoy, name='count-novedades-hoy'),
    path('api/informes/pendientes/count/', count_informes_pendientes, name='count-informes-pendientes'),
    path('api/formulario/informes/', formulario_informes, name="formulario-informes"),
    path('api/informes/', listar_informes, name='listar-informes'),
    path('api/informes/<int:informe_id>/', InformeDetalleCompleto.as_view(), name='informe-detalle-completo'),
    path('api/categorias-tipos-informes/', categorias_tipos_informe, name="categorias-tipos-informe"),
    path('api/vehiculo/buscar/', buscar_vehiculo, name="buscar_vehiculo"),
    path('api/rutas/', listar_ruta, name='lista_ruta'),
    path('api/areas/', listar_areas_solicitantes, name='listar_areas'),
    path('api/tipo-informes/', listar_tipoInforme, name='listar-tipo-informes'),
    path('api/motivos-negativa/', listar_motivos_negativa, name='listar-motivos-negativa'),
    path('api/motivos-negativa/crear/', CrearMotivoNegativoRapido.as_view(), name='crear-motivo-negativo-rapido'),
    path('api/admin/motivos-negativa/', AdminMotivosNegativa.as_view(), name='admin-motivos-negativa'),
    path('api/admin/motivos-negativa/<int:motivo_id>/', AdminMotivoNegativoDetalle.as_view(), name='admin-motivo-negativo-detalle'),
    path('api/motivos-positiva/', listar_motivos_positiva, name='listar-motivos-positiva'),
    path('api/motivos-positiva/crear/', CrearMotivoPositivoRapido.as_view(), name='crear-motivo-positivo-rapido'),
    path('api/admin/motivos-positiva/', AdminMotivosPositiva.as_view(), name='admin-motivos-positiva'),
    path('api/admin/motivos-positiva/<int:motivo_id>/', AdminMotivoPositivoDetalle.as_view(), name='admin-motivo-positivo-detalle'),
    path('api/admin/horario-laboral/', AdminHorarioLaboral.as_view(), name='admin-horario-laboral'),
    path('api/admin/tipos-informe/', AdminTiposInformeSLA.as_view(), name='admin-tipos-informe'),
    path('api/admin/tipos-informe/<int:tipo_informe_id>/', AdminTipoInformeSLADetalle.as_view(), name='admin-tipo-informe-detalle'),
    path('api/admin/categorias-tipo-informe/', AdminCategoriasTipoInforme.as_view(), name='admin-categorias-tipo-informe'),
    path('api/usuarios/analistas/', listar_analistas, name='listar-analistas'),
    path('api/novedades/<int:novedad_id>/asignar-analista/', AsignarAnalista.as_view(), name='asignar-analista'),
    path('api/admin/metricas-analistas/', metricas_analistas, name='metricas-analistas'),
    path('api/admin/informes/<int:informe_id>/', AdminInformeDetalle.as_view(), name='admin-informe-detalle'),
    path('api/configuracion-sitio/', configuracion_sitio, name='configuracion-sitio'),
    path('api/admin/configuracion-sitio/', AdminConfiguracionSitio.as_view(), name='admin-configuracion-sitio'),
    path('api/admin/usuarios/', AdminUsuarios.as_view(), name='admin-usuarios'),
    path('api/admin/usuarios/<int:usuario_id>/', AdminUsuarioDetalle.as_view(), name='admin-usuario-detalle'),
    path('api/admin/permisos/', listar_permisos_catalogo, name='admin-listar-permisos'),
    path('api/admin/roles/', listar_roles_catalogo, name='admin-listar-roles'),
    path('api/admin/usuarios/<int:usuario_id>/permisos/', AdminPermisosUsuario.as_view(), name='admin-permisos-usuario'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
