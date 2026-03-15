import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.getenv("DJANGO_DEBUG", "0") == "1"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-secret-change-me")
if not DEBUG and (not SECRET_KEY or SECRET_KEY == "dev-secret-change-me"):
    raise RuntimeError(
        "DJANGO_SECRET_KEY mancante o insicura: in produzione (DJANGO_DEBUG=0) "
        "devi impostare una chiave forte tramite env var."
    )

ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
AUDIT_STRICT = os.getenv("AUDIT_STRICT", "0") == "1"


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


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
    "drive",
    "issues",
    "feedback.apps.FeedbackConfig",
]

# --- CSRF / Origin handling ---
# Django non supporta wildcard tipo http://* in CSRF_TRUSTED_ORIGINS.
# In LAN/dev può essere comodo disattivare *solo* la verifica Origin/Referer
# mantenendo comunque il token CSRF attivo (admin e form continuano a funzionare).
CSRF_ALLOW_ALL_ORIGINS = os.getenv("CSRF_ALLOW_ALL_ORIGINS", "0") == "1"

# Guard-rail: questa opzione è SOLO per dev/LAN. In produzione (DEBUG=0) è pericolosa.
if CSRF_ALLOW_ALL_ORIGINS and not DEBUG:
    raise RuntimeError(
        "CSRF_ALLOW_ALL_ORIGINS=1 è consentito solo in dev (DJANGO_DEBUG=1). "
        "Disattivalo e usa CSRF_TRUSTED_ORIGINS per gli origin autorizzati."
    )
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
        "PASSWORD": os.getenv("DB_PASSWORD"),  # Nessun default: deve essere impostata via env.
        "HOST": os.getenv("DB_HOST", "db"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

# Guard-rail: DB_PASSWORD obbligatoria (non esiste un default sicuro).
if not os.getenv("DB_PASSWORD"):
    raise RuntimeError(
        "DB_PASSWORD non impostata. "
        "Imposta la variabile d'ambiente DB_PASSWORD prima di avviare l'applicazione."
    )

# ── Cache ─────────────────────────────────────────────────────────────────────
# In produzione (REDIS_URL impostata) si usa Redis via django-redis.
# In dev locale (REDIS_URL vuota) si ricade su LocMemCache, accettabile con un
# solo processo. ATTENZIONE: LocMemCache NON è condivisa tra worker Gunicorn —
# in produzione REDIS_URL deve essere sempre impostata, altrimenti il
# rate-limiting sul login funziona solo per-worker (bypass ×N worker).
_REDIS_URL = os.getenv("REDIS_URL", "")

if _REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": _REDIS_URL,
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                # Solleva eccezione in caso di errore Redis invece di silenziare.
                # Cambia in True per un fallback silenzioso (degrada a nessun caching).
                "IGNORE_EXCEPTIONS": False,
            },
            "KEY_PREFIX": "inventoryapp",
        }
    }
else:
    # Dev-only fallback: non usare in produzione con più worker Gunicorn.
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        }
    }

# Guard-rail: avvisa se si va in produzione senza Redis.
if not DEBUG and not _REDIS_URL:
    import warnings
    warnings.warn(
        "REDIS_URL non impostata in produzione: il rate-limiting sul login usa "
        "LocMemCache e NON è condiviso tra worker Gunicorn. "
        "Imposta REDIS_URL per una protezione efficace.",
        RuntimeWarning,
        stacklevel=2,
    )

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
    "VERSION": "0.5.0",
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

AUTH_LOGIN_FAILURE_LIMIT = int(os.getenv("AUTH_LOGIN_FAILURE_LIMIT", "5"))
AUTH_LOGIN_IP_FAILURE_LIMIT = int(os.getenv("AUTH_LOGIN_IP_FAILURE_LIMIT", "20"))
AUTH_LOGIN_WINDOW_SECONDS = int(os.getenv("AUTH_LOGIN_WINDOW_SECONDS", "900"))

# Consigliato se NON usi CSRF_ALLOW_ALL_ORIGINS.
# Metti qui gli host/porte reali da cui apri admin/frontend.
# Esempio: http://172.26.103.124:6382,http://172.26.103.124:6383
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
    if o.strip()
]

# --- Production hardening / proxy awareness ---
# Defaults stay dev-friendly, while production can be hardened via env vars
# without changing code or baking assumptions about TLS termination.
USE_X_FORWARDED_HOST = _env_bool("DJANGO_USE_X_FORWARDED_HOST", default=not DEBUG)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https") if _env_bool(
    "DJANGO_SECURE_PROXY_SSL_HEADER", default=not DEBUG
) else None

SESSION_COOKIE_SECURE = _env_bool("DJANGO_SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = _env_bool("DJANGO_CSRF_COOKIE_SECURE", default=not DEBUG)
SESSION_COOKIE_HTTPONLY = _env_bool("DJANGO_SESSION_COOKIE_HTTPONLY", default=True)
CSRF_COOKIE_HTTPONLY = _env_bool("DJANGO_CSRF_COOKIE_HTTPONLY", default=False)
SESSION_COOKIE_SAMESITE = os.getenv("DJANGO_SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.getenv("DJANGO_CSRF_COOKIE_SAMESITE", "Lax")
SECURE_SSL_REDIRECT = _env_bool("DJANGO_SECURE_SSL_REDIRECT", default=False)
SECURE_CONTENT_TYPE_NOSNIFF = _env_bool("DJANGO_SECURE_CONTENT_TYPE_NOSNIFF", default=True)
SECURE_REFERRER_POLICY = os.getenv("DJANGO_SECURE_REFERRER_POLICY", "same-origin")
SECURE_CROSS_ORIGIN_OPENER_POLICY = os.getenv(
    "DJANGO_SECURE_CROSS_ORIGIN_OPENER_POLICY", "same-origin"
)
SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = _env_bool(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", default=False
)
SECURE_HSTS_PRELOAD = _env_bool("DJANGO_SECURE_HSTS_PRELOAD", default=False)

if SECURE_HSTS_SECONDS and not SESSION_COOKIE_SECURE:
    raise RuntimeError(
        "DJANGO_SECURE_HSTS_SECONDS > 0 richiede DJANGO_SESSION_COOKIE_SECURE=1."
    )
if SECURE_HSTS_SECONDS and not CSRF_COOKIE_SECURE:
    raise RuntimeError(
        "DJANGO_SECURE_HSTS_SECONDS > 0 richiede DJANGO_CSRF_COOKIE_SECURE=1."
    )

DJANGO_RUN_DEPLOY_CHECK = _env_bool("DJANGO_RUN_DEPLOY_CHECK", default=not DEBUG)
