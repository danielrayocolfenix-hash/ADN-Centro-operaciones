"""
Optimización automática de imágenes, a nivel de todo el proyecto.

En vez de tocar cada vista que recibe un archivo (evidencia de novedades,
logo del sitio, capturas del constructor de informes, evidencia de
mantenimientos...), esto se conecta una sola vez como señal `pre_save` sobre
TODOS los modelos de las apps propias (ver ready() en apps/configuracion/
apps.py) e intercepta cualquier ImageField/FileField que traiga un archivo
recién subido (todavía no escrito a disco) antes de guardarlo: lo
redimensiona si es más grande de lo razonable y lo recomprime.

Por qué acá y no por-view: ya hubo un incidente real con esto -- el
constructor de informes manda varias imágenes en un solo POST en base64 y
tumbaba la petición contra el límite de tamaño de Django (ver
DATA_UPLOAD_MAX_MEMORY_SIZE en settings.py). Subir ese límite fue el parche
puntual; esto ataca la causa de fondo para que ni siquiera lleguen a pesar
tanto, sin depender de que cada view nueva se acuerde de optimizar sus
imágenes.
"""

import io
import os

from django.core.files.base import ContentFile
from django.db.models import FileField
from django.db.models.signals import pre_save

try:
    from PIL import Image, ImageOps, UnidentifiedImageError
except ImportError:  # Pillow no debería faltar (ImageField ya depende de él), pero por si acaso.
    Image = None

ANCHO_MAXIMO = 1920
ALTO_MAXIMO = 1920
CALIDAD_JPEG = 82


def _optimizar_bytes_imagen(nombre_original, datos):
    """
    Devuelve un ContentFile optimizado, o None si no hay que tocar el
    archivo (no es una imagen que Pillow pueda abrir -- PDF, SVG, etc. --,
    es un GIF animado, o la versión "optimizada" terminaría pesando más que
    la original).
    """
    if Image is None or not datos:
        return None
    try:
        imagen = Image.open(io.BytesIO(datos))
        imagen.load()
    except (UnidentifiedImageError, OSError, ValueError):
        return None  # no es una imagen (PDF, SVG, archivo corrupto...) -- se deja tal cual

    # No tocar GIFs animados (Pillow los aplanaría a un solo frame estático).
    if (imagen.format or "").upper() == "GIF" and getattr(imagen, "is_animated", False):
        return None

    imagen = ImageOps.exif_transpose(imagen)  # corrige fotos de celular giradas por metadata EXIF

    if imagen.width > ANCHO_MAXIMO or imagen.height > ALTO_MAXIMO:
        imagen.thumbnail((ANCHO_MAXIMO, ALTO_MAXIMO), Image.LANCZOS)

    tiene_transparencia = imagen.mode in ("RGBA", "LA") or (imagen.mode == "P" and "transparency" in imagen.info)

    buffer = io.BytesIO()
    try:
        if tiene_transparencia:
            imagen.convert("RGBA").save(buffer, format="PNG", optimize=True)
            extension = "png"
        else:
            imagen.convert("RGB").save(buffer, format="JPEG", quality=CALIDAD_JPEG, optimize=True)
            extension = "jpg"
    except OSError:
        return None

    optimizada = buffer.getvalue()
    if len(optimizada) >= len(datos):
        return None  # la original ya estaba más liviana -- no vale la pena reemplazarla

    nombre_base = os.path.splitext(os.path.basename(nombre_original or "imagen"))[0]
    return ContentFile(optimizada, name=f"{nombre_base}.{extension}")


def _optimizar_imagenes_antes_de_guardar(sender, instance, **kwargs):
    # Solo modelos propios del proyecto (apps.*) -- no tocar auth/sessions/
    # admin/contenttypes ni nada de terceros.
    if not sender.__module__.startswith("apps."):
        return

    for field in sender._meta.get_fields():
        if not isinstance(field, FileField):
            continue

        filefield = getattr(instance, field.attname, None)
        if not filefield or getattr(filefield, "_committed", True):
            continue  # vacío, o ya es un archivo existente sin cambios -- no reprocesar

        try:
            datos = filefield.file.read()
        except Exception:
            continue

        optimizada = _optimizar_bytes_imagen(filefield.name, datos)
        if optimizada:
            setattr(instance, field.name, optimizada)


def conectar():
    pre_save.connect(
        _optimizar_imagenes_antes_de_guardar,
        dispatch_uid="configuracion.optimizar_imagenes_antes_de_guardar",
    )
