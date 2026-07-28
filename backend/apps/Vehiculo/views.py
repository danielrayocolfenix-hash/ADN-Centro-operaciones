from django.http import JsonResponse
from .models import Vehiculo


def buscar_vehiculo(request):

    q = request.GET.get('q', '').strip()

    if not q:
        return JsonResponse([], safe=False)

    vehiculos = (
        Vehiculo.objects
        .filter(
            placa__icontains=q,
            estado=True
        )
        .select_related(
            'cliente',
            'grupo_flota'
        )[:5]
    )

    data = [

        {
            "id": v.id,

            "label": f"{v.placa} - {v.numero_interno}",

            # visibles
            "placa": v.placa,
            "numero_interno": v.numero_interno,
            "cliente": str(v.cliente),
            "grupo_flota": v.grupo_flota.nombre_grupo,

            # ocultos
            "vehiculo_id": v.id,
            "cliente_id": v.cliente_id,
            "grupo_flota_id": v.grupo_flota_id,
        }

        for v in vehiculos
    ]

    return JsonResponse(data, safe=False)