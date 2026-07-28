from django.http import JsonResponse
from apps.Cliente.models import Area

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