from django.urls import path

from . import auth_views

urlpatterns = [
    path("csrf/", auth_views.csrf, name="auth-csrf"),
    path("login/", auth_views.login_view, name="auth-login"),
    path("logout/", auth_views.logout_view, name="auth-logout"),
]
