import json
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_protect
from django.utils.decorators import method_decorator
from apps.usuarios_colfenix.models import UsuariosColfenix


def _serializar_usuario(usuario):
    return {
        "id": usuario.id,
        "username": usuario.username,
        "nombre": usuario.get_full_name() or usuario.username,
        "rol": usuario.rol,
        "is_staff": usuario.is_staff,
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
    if not request.user.is_staff:
        return _sin_permiso()
    analistas = UsuariosColfenix.objects.filter(rol__icontains="analista", is_active=True)
    data = [{"value": a.id, "label": str(a)} for a in analistas]
    return JsonResponse(data, safe=False)
