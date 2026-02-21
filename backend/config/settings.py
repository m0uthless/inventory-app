import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",

    "corsheaders",

    "rest_framework",
    "django_filters",
    "drf_spectacular",
    "import_export",

    "audit.apps.AuditConfig",
    "custom_fields",
    "core",
    "crm",
    "inventory",
    "maintenance",
    "wiki",
]

# --- CSRF / Origin handling ---
# Django non supporta wildcard tipo http://* in CSRF_TRUSTED_ORIGINS.
# In LAN/dev può essere comodo disattivare *solo* la verifica Origin/Referer
# mantenendo comunque il token CSRF attivo (admin e form continuano a funzionare).
CSRF_ALLOW_ALL_ORIGINS = os.getenv("CSRF_ALLOW_ALL_ORIGINS", "0") == "1"
CSRF_MIDDLEWARE = (
    "core.middleware.CsrfAllowAllOriginsMiddleware"
    if CSRF_ALLOW_ALL_ORIGINS
    else "django.middleware.csrf.CsrfViewMiddleware"
)

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    CSRF_MIDDLEWARE,
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "inventory_app"),
        "USER": os.getenv("DB_USER", "inventory_app"),
        "PASSWORD": os.getenv("DB_PASSWORD", "inventory_app"),
        "HOST": os.getenv("DB_HOST", "db"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "it-it"
TIME_ZONE = os.getenv("TIME_ZONE", "Europe/Rome")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
_static_dir = BASE_DIR / "static"
STATICFILES_DIRS = [_static_dir] if _static_dir.exists() else []
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/api/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

if DEBUG:
    # In sviluppo accettiamo richieste da qualsiasi origine
    CORS_ALLOW_ALL_ORIGINS = True
else:
    # In produzione specificare i domini esatti tramite env var
    # Es: DJANGO_CORS_ORIGINS=https://app.example.com,https://admin.example.com
    CORS_ALLOWED_ORIGINS = [
        o.strip()
        for o in os.getenv("DJANGO_CORS_ORIGINS", "").split(",")
        if o.strip()
    ]

SPECTACULAR_SETTINGS = {
    "TITLE": "Inventory App API",
    "VERSION": "0.2.1",
}

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "core.permissions.IsAuthenticatedDjangoModelPermissions",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "PAGE_SIZE_QUERY_PARAM": "page_size",
    "MAX_PAGE_SIZE": 200,
}
# Se fai chiamate cross-origin (es. Vite 5173 -> 6382) e vuoi cookie session:
CORS_ALLOW_CREDENTIALS = True

# Consigliato se NON usi CSRF_ALLOW_ALL_ORIGINS.
# Metti qui gli host/porte reali da cui apri admin/frontend.
# Esempio: http://172.26.103.124:6382,http://172.26.103.124:6383
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
    if o.strip()
]
