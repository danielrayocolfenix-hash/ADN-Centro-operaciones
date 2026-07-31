import json
from django.http import JsonResponse
from django.views import View
from django.db.models import Count
from apps.Cliente.models import Area, Cliente
from apps.configuracion.permisos import tiene_permiso


def _no_autenticado():
    return JsonResponse({"success": False, "mensaje": "Debes iniciar sesión."}, status=401)


def _sin_permiso():
    return JsonResponse({"success": False, "mensaje": "No tienes permisos para esta acción."}, status=403)

def listar_areas_solicitantes(request):
    areas = Area.objects.filter(estado__iexact="Activo").order_by("nombre")

    data = [
        {
            "value": a.id,
            "label": a.nombre
        }
        for a in areas
    ]

    return JsonResponse(data, safe=False)


def listar_clientes(request):
    """
    GET /api/clientes/ -- catálogo simple (id/nombre) de clientes activos.
    Usado hoy por el selector de "Vista de cliente" en Administración -- no
    requiere ningún permiso especial, solo sesión iniciada, igual que
    listar_areas_solicitantes.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "mensaje": "Debes iniciar sesión."}, status=401)
    clientes = Cliente.objects.filter(estado="ACTIVO").order_by("nombre")
    data = [{"value": c.id, "label": c.nombre} for c in clientes]
    return JsonResponse(data, safe=False)


def _serializar_cliente(c):
    return {
        "id": c.id,
        "codigo": c.codigo,
        "nombre": c.nombre,
        "nit": c.nit,
        "contacto": c.contacto,
        "telefono": c.telefono,
        "email": c.email,
        "ciudad": c.ciudad,
        "estado": c.estado,
        "estado_display": c.get_estado_display(),
        "vehiculos_count": c.vehiculos_count,
        "fecha_creacion": c.fecha_creacion,
    }


class AdminClientes(View):
    """
    GET  /api/admin/clientes/ -- listado completo (activos e inactivos, a
         diferencia de listar_clientes que solo trae activos para selectores)
         para Clientes en el dashboard interno. Requiere `vista.clientes`.
    POST /api/admin/clientes/ -- crear un cliente nuevo. Requiere
         `clientes.crear`. El código lo genera el frontend
         (generarCodigoCliente) y viaja en el payload; acá solo se valida
         que no choque con uno ya existente.
    """

    def get(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "vista.clientes"):
            return _sin_permiso()
        clientes = Cliente.objects.annotate(vehiculos_count=Count("vehiculos")).order_by("nombre")
        return JsonResponse([_serializar_cliente(c) for c in clientes], safe=False)

    def post(self, request):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "clientes.crear"):
            return _sin_permiso()
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)

        nombre = (data.get("nombre") or "").strip()
        nit = (data.get("nit") or "").strip()
        if not nombre or not nit:
            return JsonResponse({"success": False, "mensaje": "El nombre y el NIT son obligatorios."}, status=400)

        codigo = (data.get("codigo") or "").strip() or None
        if codigo and Cliente.objects.filter(codigo=codigo).exists():
            return JsonResponse({"success": False, "mensaje": f"Ya existe un cliente con el código '{codigo}'."}, status=400)
        if Cliente.objects.filter(nit=nit).exists():
            return JsonResponse({"success": False, "mensaje": f"Ya existe un cliente con el NIT '{nit}'."}, status=400)

        cliente = Cliente.objects.create(
            nombre=nombre,
            nit=nit,
            codigo=codigo,
            contacto=(data.get("contacto") or "").strip(),
            telefono=(data.get("telefono") or "").strip(),
            email=(data.get("email") or "").strip(),
            ciudad=(data.get("ciudad") or "").strip(),
            estado=data.get("estado") or "ACTIVO",
        )
        cliente.vehiculos_count = 0
        return JsonResponse({"success": True, "cliente": _serializar_cliente(cliente)})


class AdminClienteDetalle(View):
    """
    POST   /api/admin/clientes/<id>/ -- edita los campos de un cliente.
           Requiere `clientes.editar`.
    DELETE /api/admin/clientes/<id>/ -- "eliminar" desde la UI en realidad
           desactiva (estado=INACTIVO), nunca borra la fila -- mismo criterio
           que AdminUsuarioDetalle con los usuarios: Novedades.cliente es
           on_delete=PROTECT, así que un cliente con alguna novedad ya
           registrada no se puede borrar de verdad sin perder ese historial.
           Requiere `clientes.eliminar`.
    """

    def post(self, request, cliente_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "clientes.editar"):
            return _sin_permiso()
        try:
            cliente = Cliente.objects.annotate(vehiculos_count=Count("vehiculos")).get(id=cliente_id)
        except Cliente.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El cliente no existe."}, status=404)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "mensaje": "Cuerpo de la solicitud inválido."}, status=400)

        nuevo_codigo = data.get("codigo")
        if nuevo_codigo and Cliente.objects.exclude(id=cliente.id).filter(codigo=nuevo_codigo).exists():
            return JsonResponse({"success": False, "mensaje": f"Ya existe un cliente con el código '{nuevo_codigo}'."}, status=400)
        nuevo_nit = data.get("nit")
        if nuevo_nit and Cliente.objects.exclude(id=cliente.id).filter(nit=nuevo_nit).exists():
            return JsonResponse({"success": False, "mensaje": f"Ya existe un cliente con el NIT '{nuevo_nit}'."}, status=400)

        for campo in ("nombre", "nit", "codigo", "contacto", "telefono", "email", "ciudad", "estado"):
            if campo in data:
                setattr(cliente, campo, (data[campo] or "").strip() if isinstance(data[campo], str) else data[campo])
        cliente.save()

        return JsonResponse({"success": True, "cliente": _serializar_cliente(cliente)})

    def delete(self, request, cliente_id):
        if not request.user.is_authenticated:
            return _no_autenticado()
        if not tiene_permiso(request.user, "clientes.eliminar"):
            return _sin_permiso()
        try:
            cliente = Cliente.objects.get(id=cliente_id)
        except Cliente.DoesNotExist:
            return JsonResponse({"success": False, "mensaje": "El cliente no existe."}, status=404)
        cliente.estado = "INACTIVO"
        cliente.save(update_fields=["estado", "fecha_actualizacion"])
        return JsonResponse({"success": True, "mensaje": f"Cliente '{cliente.nombre}' desactivado."})


def dashboard_resumen(request):
    """
    GET /api/dashboard/resumen/ -- conteos reales para las tarjetas KPI del
    Dashboard que no salen de /api/novedades/ (esas se calculan en el
    frontend, igual que ya hace CasosPrioritariosCard en DashboardPage.jsx).
    Solo requiere sesión iniciada -- son conteos, no datos sensibles por
    cliente, igual que listar_clientes/listar_areas_solicitantes.
    """
    if not request.user.is_authenticated:
        return _no_autenticado()
    from apps.Vehiculo.models import Vehiculo

    return JsonResponse({
        "clientes_total": Cliente.objects.count(),
        "clientes_activos": Cliente.objects.filter(estado="ACTIVO").count(),
        "vehiculos_total": Vehiculo.objects.count(),
        "vehiculos_activos": Vehiculo.objects.filter(estado=True).count(),
    })