import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def get_bool_env(name: str, default: bool = False) -> bool:
    """Read a boolean environment variable using explicit accepted values."""
    value = os.getenv(name)
    if value is None:
        return default

    normalized_value = value.strip().lower()
    if normalized_value in {"1", "true", "yes", "on"}:
        return True
    if normalized_value in {"0", "false", "no", "off"}:
        return False
    raise ImproperlyConfigured(f"{name} must be a valid boolean value.")


def get_list_env(name: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, '').split(',') if item.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in the environment.")

DEBUG = get_bool_env("DJANGO_DEBUG", default=False)
ON_RAILWAY = bool(os.getenv('RAILWAY_ENVIRONMENT'))
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if host.strip()
]


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'cep',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.getenv('DB_NAME', 'qarib_db'),
        'USER': os.getenv('DB_USER', 'qarib_user'),
        'PASSWORD': os.getenv('DB_PASSWORD', ''),
        'HOST': os.getenv('DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('DB_PORT', '3306'),
        'CONN_MAX_AGE': 0,
        'OPTIONS': {
            'charset': 'utf8mb4',
        },
    }
}


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_ROOT = BASE_DIR / 'media'

STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

MEDIA_STORAGE_BACKEND = os.getenv('MEDIA_STORAGE_BACKEND', 'filesystem').strip().lower()
if MEDIA_STORAGE_BACKEND == 's3':
    s3_variables = {
        'bucket_name': 'S3_BUCKET_NAME',
        'access_key': 'S3_ACCESS_KEY_ID',
        'secret_key': 'S3_SECRET_ACCESS_KEY',
        'endpoint_url': 'S3_ENDPOINT_URL',
        'region_name': 'S3_REGION_NAME',
    }
    missing = [name for name in s3_variables.values() if not os.getenv(name)]
    if missing:
        raise ImproperlyConfigured(f"S3 storage requires: {', '.join(missing)}")
    STORAGES['default'] = {
        'BACKEND': 'storages.backends.s3.S3Storage',
        'OPTIONS': {
            **{option: os.environ[name] for option, name in s3_variables.items()},
            'default_acl': None,
            'querystring_auth': True,
            'custom_domain': None,
            'file_overwrite': False,
        },
    }
elif MEDIA_STORAGE_BACKEND != 'filesystem':
    raise ImproperlyConfigured('MEDIA_STORAGE_BACKEND must be filesystem or s3.')
elif ON_RAILWAY:
    raise ImproperlyConfigured('Railway requires MEDIA_STORAGE_BACKEND=s3 for durable uploads.')

CORS_ALLOWED_ORIGINS = get_list_env('CORS_ALLOWED_ORIGINS')
CORS_URLS_REGEX = r'^/api/.*$'
CSRF_TRUSTED_ORIGINS = get_list_env('CSRF_TRUSTED_ORIGINS')
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') if ON_RAILWAY else None
SECURE_SSL_REDIRECT = ON_RAILWAY and not DEBUG
SESSION_COOKIE_SECURE = ON_RAILWAY and not DEBUG
CSRF_COOKIE_SECURE = ON_RAILWAY and not DEBUG
SECURE_HSTS_SECONDS = 3600 if ON_RAILWAY and not DEBUG else 0

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'cep.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'password_reset': '5/hour',
        'email_otp_request': '10/hour',
        'email_otp_confirm': '30/hour',
        'password_change': '10/hour',
    },
}

PASSWORD_RESET_TIMEOUT = 30 * 60

FRONTEND_BASE_URL = os.getenv('FRONTEND_BASE_URL', 'http://localhost:5173').rstrip('/')
if ON_RAILWAY:
    if DEBUG:
        raise ImproperlyConfigured('DJANGO_DEBUG must be False on Railway.')
    if not os.getenv('DJANGO_ALLOWED_HOSTS') or '*' in ALLOWED_HOSTS:
        raise ImproperlyConfigured('Set DJANGO_ALLOWED_HOSTS to the exact backend hostname on Railway.')
    if not FRONTEND_BASE_URL.startswith('https://'):
        raise ImproperlyConfigured('FRONTEND_BASE_URL must be an HTTPS URL on Railway.')
    if FRONTEND_BASE_URL not in CORS_ALLOWED_ORIGINS:
        raise ImproperlyConfigured('Add FRONTEND_BASE_URL to CORS_ALLOWED_ORIGINS on Railway.')
    if not all(origin.startswith('https://') for origin in CORS_ALLOWED_ORIGINS + CSRF_TRUSTED_ORIGINS):
        raise ImproperlyConfigured('Railway CORS and CSRF origins must use HTTPS.')
    if not os.getenv('S3_ENDPOINT_URL', '').startswith('https://'):
        raise ImproperlyConfigured('S3_ENDPOINT_URL must use HTTPS on Railway.')

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = get_bool_env('EMAIL_USE_TLS', default=True)
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
EMAIL_TIMEOUT = 10
if ON_RAILWAY and (not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD):
    raise ImproperlyConfigured('EMAIL_HOST_USER and EMAIL_HOST_PASSWORD are required on Railway.')

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
    'UPDATE_LAST_LOGIN': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
