from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect

from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from audit.utils import log_event, log_auth_attempt


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
@authentication_classes([])  # non serve auth per ottenere csrftoken
def csrf(request):
    # setta il cookie csrftoken
    return Response(status=status.HTTP_204_NO_CONTENT)


@csrf_protect
@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])  # login “pubblico” (ma protetto da CSRF)
def login_view(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""

    user = authenticate(request, username=username, password=password)
    if user is None:
        # Audit failed login (invalid credentials). Never store passwords.
        log_auth_attempt(action="login_failed", username=username or None, request=request, reason="invalid_credentials")
        return Response({"detail": "Credenziali non valide."}, status=status.HTTP_400_BAD_REQUEST)
    if not user.is_active:
        # Audit failed login (disabled user)
        log_auth_attempt(action="login_failed", username=username or None, user=user, actor=user, request=request, reason="disabled")
        return Response({"detail": "Utente disabilitato."}, status=status.HTTP_403_FORBIDDEN)

    login(request, user)  # crea sessione

    # Nota: il login viene già tracciato via signal (user_logged_in) in audit/signals.py

    return Response({"detail": "ok"}, status=status.HTTP_200_OK)


@csrf_protect
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    # Audit logout prima di invalidare la sessione
    try:
        log_event(actor=request.user, action="logout", instance=request.user, request=request)
    except Exception:
        pass

    logout(request)
    return Response({"detail": "ok"}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    u = request.user
    return Response(
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "is_staff": u.is_staff,
            "is_superuser": u.is_superuser,
            "groups": list(u.groups.values_list("name", flat=True)),
            "permissions": sorted(list(u.get_all_permissions())),
        }
    )
