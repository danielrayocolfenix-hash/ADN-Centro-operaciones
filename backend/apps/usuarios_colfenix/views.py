import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from apps.usuarios_colfenix.models import UsuariosColfenix, RolUsuario
from apps.configuracion.models import Permiso
from apps.configuracion.permisos import tiene_permiso, claves_de, CLAVES_BASE_POR_DEFECTO


def _registrar_rol_si_es_nuevo(rol):
    """Agrega `rol` al catálogo de sugerencias si todavía no está -- así el
    campo híbrido de la UI (select + puede escribirse uno nuevo) no requiere
    un paso separado de "crear rol", basta con guardar el usuario."""
    rol = (rol or "").strip()
    if rol:
        RolUsuario.objects.get_or_create(nombre=rol)


def _serializar_usuario(usuario):
    return {
        "id": usuario.id,
        "username": usuario.username,
        "nombre": usuario.get_full_name() or usuario.username,
        "rol": usuario.rol,
        "is_staff": usuario.is_staff,
        # tipo=CLIENTE es lo que el frontend usa para decidir si renderiza
        # el Shell interno o el Portal de cliente -- ver App.jsx.
        "tipo": usuario.tipo,
        "cliente_id": usuario.cliente_id,
        "cliente": usuario.cliente.nombre if usuario.cliente_id else None,
        # Claves de permiso que tiene -- el catálogo completo si es_staff,
        # o su set explícito si no. El frontend hace `permisos.includes(clave)`
        # sin tener que repetir en cada componente la lógica de "is_staff
        # implica todo".
        "permisos": claves_de(usuario),
    }


def _no_autenticado():
    return JsonResponse({"success": False, "mensaje": "Debes iniciar sesión."}, status=401)


def _sin_permiso():
    return JsonResponse({"success": False, "mensaje": "No tienes permisos para esta acción."}, status=403)


@method_decorator(csrf_protect, name="post")
class LoginView(View):
    def post(self, request):
        try:
            data = json.loads(request.body)
            username = data.get("username", "").strip()
            password = data.get("password", "")
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)

        if not username or not password:
            return JsonResponse({"success": False, "mensaje": "Usuario y contraseña son obligatorios."}, status=400)

        usuario = authenticate(request, username=username, password=password)
        if usuario is None:
            return JsonResponse({"success": False, "mensaje": "Usuario o contraseña incorrectos."}, status=401)

        login(request, usuario)
        return JsonResponse({"success": True, "usuario": _serializar_usuario(usuario)})


class LogoutView(View):
    def post(self, request):
        logout(request)
        return JsonResponse({"success": True})


def me(request):
    if not request.user.is_authenticated:
        return JsonResponse({"usuario": None}, status=401)
    return JsonResponse({"usuario": _serializar_usuario(request.user)})


def _serializar_usuario_admin(u):
    return {
        "id": u.id,
        "username": u.username,
        "nombre": u.get_full_name() or u.username,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "rol": u.rol,
        "is_staff": u.is_staff,
        "is_active": u.is_active,
        "cantidad_permisos": u.permisos.count(),
    }


class AdminUsuarios(View):
    """
    GET  /api/admin/usuarios/ -- listado, para Administración › Usuarios.
         Requiere `vista.administracion_usuarios` (no necesariamente
         is_staff): un usuario no-staff al que se le otorgue ese permiso
         puntual también puede entrar a esta pantalla, sin volverse is_staff.
    POST /api/admin/usuarios/ -- crear un usuario nuevo. Requiere
         `administracion.gestionar_usuarios`, una capacidad que no existía
         en el dashboard hasta ahora, así que solo la tiene quien ya es
         is_staff (ver migración 0006).
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "vista.administracion_usuarios"):
            return _sin_permiso()
        usuarios = UsuariosColfenix.objects.all().order_by("first_name", "last_name", "username")
        return JsonResponse([_serializar_usuario_admin(u) for u in usuarios], safe=False)

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_usuarios"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
            username = (data.get("username") or "").strip()
            password = data.get("password") or ""
            if not username:
                return JsonResponse({"success": False, "mensaje": "El usuario (username) es obligatorio."}, status=400)
            try:
                validate_password(password)
            except ValidationError as e:
                return JsonResponse({"success": False, "mensaje": " ".join(e.messages)}, status=400)

            # Solo quien ya es is_staff puede crear otra cuenta is_staff --
            # evita que alguien con `administracion.gestionar_usuarios` pero
            # sin is_staff se autoescale creando un usuario administrador.
            es_staff_nuevo = bool(data.get("is_staff")) and request.user.is_staff

            usuario = UsuariosColfenix(
                username=username,
                first_name=data.get("first_name", "").strip(),
                last_name=data.get("last_name", "").strip(),
                rol=data.get("rol", ""),
                is_staff=es_staff_nuevo,
                is_active=True,
            )
            usuario.set_password(password)
            usuario.save()
            _registrar_rol_si_es_nuevo(usuario.rol)

            if not es_staff_nuevo:
                usuario.permisos.set(Permiso.objects.filter(clave__in=CLAVES_BASE_POR_DEFECTO))

            return JsonResponse({"success": True, "usuario": _serializar_usuario_admin(usuario)})
        except IntegrityError:
            return JsonResponse({"success": False, "mensaje": "Ese nombre de usuario ya existe."}, status=400)
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)


class AdminUsuarioDetalle(View):
    """
    POST /api/admin/usuarios/<usuario_id>/ -- edita nombre/rol/is_active de
    un usuario existente, y opcionalmente is_active para desactivarlo. No
    existe un DELETE real: un usuario que alguna vez fue analista de una
    novedad no se puede borrar (Novedades.analista es on_delete=PROTECT), y
    borrar la cuenta perdería su rastro en la Trazabilidad -- desactivarlo
    (is_active=False) le quita el acceso sin perder ese historial.
    """

    def post(self, request, usuario_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.gestionar_usuarios"):
            return _sin_permiso()
        try:
            usuario = UsuariosColfenix.objects.get(id=usuario_id)
        except UsuariosColfenix.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El usuario no existe."}, status=404)

        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)

        if "first_name" in data:
            usuario.first_name = (data["first_name"] or "").strip()
        if "last_name" in data:
            usuario.last_name = (data["last_name"] or "").strip()
        if "rol" in data:
            usuario.rol = data["rol"] or ""
        if "is_active" in data:
            usuario.is_active = bool(data["is_active"])
        if "password" in data and data["password"]:
            try:
                validate_password(data["password"])
            except ValidationError as e:
                return JsonResponse({"success": False, "mensaje": " ".join(e.messages)}, status=400)
            usuario.set_password(data["password"])

        if "is_staff" in data:
            # El flag maestro is_staff solo lo puede tocar otro is_staff real
            # (no basta con `administracion.gestionar_usuarios`), y nadie se
            # puede quitar su propio is_staff -- evita un autobloqueo.
            if not request.user.is_staff:
                return JsonResponse({"success": False, "mensaje": "Solo un administrador puede otorgar o quitar ese rol."}, status=403)
            if usuario.id == request.user.id and not data["is_staff"]:
                return JsonResponse({"success": False, "mensaje": "No puedes quitarte tu propio acceso de administrador."}, status=400)
            usuario.is_staff = bool(data["is_staff"])

        usuario.save()
        _registrar_rol_si_es_nuevo(usuario.rol)
        return JsonResponse({"success": True, "usuario": _serializar_usuario_admin(usuario)})


def listar_roles_catalogo(request):
    """GET /api/admin/roles/ -- sugerencias para el campo híbrido de rol."""
    if not request.user.is_authenticated:
        return _no_autenticado()
    if not tiene_permiso(request.user, "vista.administracion_usuarios"):
        return _sin_permiso()
    return JsonResponse(list(RolUsuario.objects.values_list("nombre", flat=True)), safe=False)


def listar_permisos_catalogo(request):
    """GET /api/admin/permisos/ -- catálogo completo (fijo, no editable)."""
    if not request.user.is_authenticated:
        return _no_autenticado()
    if not tiene_permiso(request.user, "vista.administracion_usuarios"):
        return _sin_permiso()
    permisos = Permiso.objects.all()
    data = [
        {"id": p.id, "clave": p.clave, "etiqueta": p.etiqueta, "categoria": p.categoria, "tipo": p.tipo}
        for p in permisos
    ]
    return JsonResponse(data, safe=False)


class AdminPermisosUsuario(View):
    """
    GET/POST /api/admin/usuarios/<usuario_id>/permisos/ -- ver y reemplazar
    el set de permisos explícitos de un usuario puntual.
    """

    def get(self, request, usuario_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "vista.administracion_usuarios"):
            return _sin_permiso()
        try:
            usuario = UsuariosColfenix.objects.get(id=usuario_id)
        except UsuariosColfenix.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El usuario no existe."}, status=404)
        return JsonResponse({
            "usuario_id": usuario.id,
            "is_staff": usuario.is_staff,
            "claves": list(usuario.permisos.values_list("clave", flat=True)),
        })

    def post(self, request, usuario_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "administracion.asignar_permisos"):
            return _sin_permiso()
        try:
            usuario = UsuariosColfenix.objects.get(id=usuario_id)
        except UsuariosColfenix.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El usuario no existe."}, status=404)
        try:
            data = json.loads(request.body)
            claves = data.get("claves", [])
            if not isinstance(claves, list):
                raise ValueError("claves debe ser una lista.")
            permisos = Permiso.objects.filter(clave__in=claves)
            usuario.permisos.set(permisos)
        except (json.JSONDecodeError, ValueError) as e:
            return JsonResponse({"success": False, "mensaje": str(e)}, status=400)
        return JsonResponse({
            "success": True,
            "claves": list(usuario.permisos.values_list("clave", flat=True)),
        })


def listar_analistas(request):
    """
    Usuarios asignables a una novedad — para el selector de "Asignar
    analista". "rol" es texto libre (no hay valores canónicos garantizados
    en los datos ya existentes), así que se filtra con icontains en vez de
    una igualdad exacta para no dejar afuera usuarios reales como
    "ANALISTA" o "Analista de medios".
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    if not tiene_permiso(request.user, "novedades.asignar_analista"):
        return _sin_permiso()
    analistas = UsuariosColfenix.objects.filter(rol__icontains="analista", is_active=True)
    data = [{"value": a.id, "label": str(a)} for a in analistas]
    return JsonResponse(data, safe=False)
