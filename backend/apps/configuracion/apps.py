from django.apps import AppConfig


class ConfiguracionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.configuracion'

    def ready(self):
        # Optimización automática de imágenes en todo el proyecto (ver
        # apps/configuracion/optimizacion_imagenes.py) -- se conecta acá,
        # una sola vez, siguiendo la práctica estándar de Django para
        # registrar señales al arrancar la app.
        from apps.configuracion.optimizacion_imagenes import conectar
        conectar()
