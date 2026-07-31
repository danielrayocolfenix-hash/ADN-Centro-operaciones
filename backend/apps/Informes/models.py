from django.db import models
from apps.novedades.models import Novedades

# Create your models here.
class Informe(models.Model):

    ESTADOS = [
        ("Pendiente","Pendiente"),
        ("En_Proceso","En Proceso"),
        ("Finalizado","Finalizado"),
    ]

    codigo = models.CharField(
        max_length=100,
        unique=True,
        editable=False
    )

    novedad = models.ForeignKey(
        Novedades,
        on_delete=models.CASCADE,
        related_name="informes"
    )

    tipo_informe = models.ForeignKey(
        "TipoInforme",
        on_delete=models.PROTECT
    )

    estado = models.CharField(
        max_length=20,
        choices=ESTADOS,
        default="Pendiente"
    )

    resultado = models.CharField(
        max_length=20,
        choices=[
            ("Positiva","Positiva"),
            ("Negativa","Negativa")
        ]
    )

    version = models.CharField(
        max_length=50,
        default="Versión 1"
    )

    titulo = models.CharField(
        max_length=255,
        blank=True,
        help_text="Título del encabezado impreso, ej. 'INFORME NOVEDAD – GERENCIA JURIDICA'."
    )

    solicitud = models.TextField(
        blank=True,
        help_text="Correo o petición original del cliente."
    )

    anexos = models.TextField(
        blank=True,
        help_text="Ej. '02 clips de video con los registros de grabación.'"
    )

    mantenimientos_tabla = models.JSONField(
        default=dict,
        blank=True,
        help_text="Tabla de mantenimientos anteriores ({columnas, filas}), solo aplica a resultado Negativa."
    )

    mantenimientos_nota = models.TextField(
        blank=True
    )

    pdf=models.FileField(
        upload_to="informes/pdf/",
        blank=True,
        null=True
    )

    fecha_creacion=models.DateTimeField(auto_now_add=True)

    fecha_actualizacion=models.DateTimeField(auto_now=True)

    class Meta:
        ordering=["-fecha_creacion"]

    def __str__(self):
        return self.codigo
    
    
class InformeLogiox(models.Model):

    MODOS = [
        ("tabla", "Tabla"),
        ("imagen", "Imagen"),
    ]

    informe=models.OneToOneField(
        Informe,
        on_delete=models.CASCADE,
        related_name="logiox"
    )

    no_aplica=models.BooleanField(
        default=False
    )

    modo = models.CharField(
        max_length=10,
        choices=MODOS,
        default="tabla",
        help_text="Si el analista adjuntó una captura de Logiox en vez de construir la tabla."
    )

    tabla=models.JSONField(
        default=dict,
        blank=True
    )

    imagen=models.ImageField(
        upload_to="informes/logiox/",
        blank=True,
        null=True
    )

class SolicitudImagen(models.Model):
    """Capturas adjuntas a la Solicitud (ej. el correo del cliente en imagen),
    la solicitud puede traer más de una."""

    informe = models.ForeignKey(
        Informe,
        on_delete=models.CASCADE,
        related_name="solicitud_imagenes"
    )

    imagen = models.ImageField(
        upload_to="informes/solicitud/"
    )

    orden = models.PositiveIntegerField(
        default=1
    )

    class Meta:
        ordering = ["orden"]


class InformeRecorrido(models.Model):

    informe=models.OneToOneField(
        Informe,
        on_delete=models.CASCADE,
        related_name="recorrido"
    )

    no_aplica=models.BooleanField(
        default=False
    )

    # "Al confrontar el recorrido con la plataforma..." — texto fijo e
    # importante, siempre presente en informes Positiva (editable/con negrita).
    texto_confirmacion = models.TextField(
        blank=True
    )

    # "Se adjunta los segmentos...", autocompletado con datos de la novedad.
    intro_texto = models.TextField(
        blank=True
    )

    imagen=models.ImageField(
        upload_to="informes/recorrido/",
        blank=True,
        null=True
    )

class SegmentoAnalizado(models.Model):

    informe=models.ForeignKey(
        Informe,
        related_name="videos",
        on_delete=models.CASCADE
    )

    orden=models.PositiveIntegerField()
    hora_inicio=models.TimeField(null=True, blank=True)
    hora_fin=models.TimeField(null=True, blank=True)
    observacion=models.TextField(
        blank=True
    )
    class Meta:
        ordering=["orden"]
        
class TipoEvento(models.Model):

    nombre=models.CharField(
        max_length=150,
        unique=True
    )

    plantilla=models.TextField()

    requiere_descripcion=models.BooleanField(
        default=False
    )

    activo=models.BooleanField(
        default=True
    )

    class Meta:

        ordering=["nombre"]

    def __str__(self):

        return self.nombre
    
class EventoInforme(models.Model):

    segmento=models.ForeignKey(
        SegmentoAnalizado,
        related_name="eventos",
        on_delete=models.CASCADE
    )

    tipo=models.ForeignKey(
        TipoEvento,
        on_delete=models.PROTECT
    )

    orden=models.PositiveIntegerField()

    descripcion=models.TextField(
        blank=True
    )

    class Meta:

        ordering=["orden"]
        
class EvidenciaEvento(models.Model):

    evento=models.ForeignKey(
        EventoInforme,
        related_name="evidencias",
        on_delete=models.CASCADE
    )

    imagen=models.ImageField(
        upload_to="informes/eventos/"
    )

    descripcion=models.CharField(
        max_length=200,
        blank=True
    )

    orden=models.PositiveIntegerField(
        default=1
    )

    class Meta:

        ordering=["orden"]
    
class CategoriaTipoInforme(models.Model):
    nombre_categoria_informe = models.CharField(
        max_length= 200,
        unique= True
    )
    
    estado = models.BooleanField(
        default=True
    )
    
    def __str__(self):
        return self.nombre_categoria_informe
    
class DetalleInforme(models.Model):

    informe = models.ForeignKey(
        Informe,
        on_delete=models.CASCADE,
        related_name='detalles'
    )
    titulo = models.CharField(
        max_length=200
    )
    hora_inicio = models.TimeField(null=True, blank=True)
    hora_fin = models.TimeField(null=True, blank=True)
    orden = models.PositiveIntegerField(
        default=1
    )

    observacion = models.TextField(
        blank=True,
        null=True
    )

    imagen = models.ImageField(
        upload_to="informes/detalles/",
        blank=True,
        null=True
    )

    class Meta:
        ordering = ['orden']

    def __str__(self):
        return self.titulo
    
class PlantillaTexto(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    tipo_evento = models.ForeignKey(
        TipoEvento,
        on_delete=models.CASCADE,
        related_name="plantillas"
    )
    contenido = models.TextField(
        help_text="Ejemplo: Se evidencia un evento puntual entre las {inicio} y las {fin} horas."
    )
    activo = models.BooleanField(default=True)
    
class TipoInforme(models.Model):

    nombre = models.CharField(
        max_length=200,
        unique=True
    )
    
    categoria_informe = models.ForeignKey(
        CategoriaTipoInforme,
        on_delete=models.CASCADE,
        related_name="categoria",
        null=True
    )

    descripcion = models.TextField(
        blank=True,
        null=True
    )
    nivel_prioridad = models.CharField(
        max_length=50,
        choices=Novedades.NIVEL_PRIORIDAD,
        default='Media',
        help_text='Prioridad que se asignará automáticamente a las novedades que usen este tipo de informe.'
    )

    tiempo_maximo_horas = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Horas hábiles máximas desde ENCOLADO hasta TERMINADO. Vacío = sin SLA definido.'
    )

    activo = models.BooleanField(
        default=True
    )

    fecha_creacion = models.DateTimeField(
        auto_now_add=True
    )

    class Meta:
        ordering = ['nombre']

    def __str__(self):
        return self.nombre