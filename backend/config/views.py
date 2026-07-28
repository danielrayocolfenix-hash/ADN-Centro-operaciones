from django.http import JsonResponse


def csrf_failure(request, reason=""):
    return JsonResponse({"success": False, "mensaje": f"CSRF inválido: {reason}"}, status=403)
