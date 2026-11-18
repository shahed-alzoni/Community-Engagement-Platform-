# Railway deployment preparation

Qarib uses three Railway services: `Backend` (root `/qarib_backend`), `Frontend` (root `/qarib_frontend`), and `MySQL`. Create a private Railway Bucket for uploaded images before deploying the backend. Keep the bucket private; uploaded complaint and resolution photos continue to be served only through the existing permission-checked Django API views. Organization and category images remain served through their existing public API views.

## Service configuration

Set each service's **Config File Path** in Railway Settings (root directory does not relocate a config file):

| Service | Config File Path | Build command | Start command |
| --- | --- | --- | --- |
| Backend | `/qarib_backend/railway.toml` | `python manage.py collectstatic --noinput` | `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 1 --threads 2` |
| Frontend | `/qarib_frontend/railway.toml` | `npm run build` | `npm run start` (`sirv dist --single --host 0.0.0.0`, using Railway's `PORT`) |

Railpack installs dependencies from `requirements.txt` and `package-lock.json`. The frontend server returns `index.html` for React Router paths. The frontend's production build does **not** use Vite's local `/api` proxy; set its public backend URL before building.

Migrations are intentionally **not** included in the start command. After approving the deployment and confirming the Railway MySQL service is empty and correctly linked, run `python manage.py migrate --noinput` once against that Railway database. Never run it against local `qarib_db` as part of deployment setup.

## Backend variables

Set these in the Backend service's Variables tab. Do not copy local `.env` secrets into Git. Use the exact service names in your Railway project; `${{MySQL.*}}` and `${{Bucket.*}}` below assume the services are named `MySQL` and `Bucket`.

| Variable | Railway value / purpose |
| --- | --- |
| `DJANGO_SECRET_KEY` | A newly generated long random secret, entered only in Railway Variables. |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_ALLOWED_HOSTS` | Exact Backend hostname without `https://`, for example `backend.up.railway.app`. |
| `FRONTEND_BASE_URL` | Exact public Frontend origin, for example `https://frontend.up.railway.app`. |
| `CORS_ALLOWED_ORIGINS` | Exact public Frontend origin, same as `FRONTEND_BASE_URL`. |
| `CSRF_TRUSTED_ORIGINS` | HTTPS origins allowed for Django's CSRF-protected views, if cross-origin session requests are needed; otherwise leave empty. The JWT API does not require cross-origin cookies. |
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `DB_USER` | `${{MySQL.MYSQLUSER}}` |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
| `MEDIA_STORAGE_BACKEND` | `s3` (required on Railway) |
| `S3_BUCKET_NAME` | `${{Bucket.BUCKET}}` |
| `S3_ACCESS_KEY_ID` | `${{Bucket.ACCESS_KEY_ID}}` |
| `S3_SECRET_ACCESS_KEY` | `${{Bucket.SECRET_ACCESS_KEY}}` |
| `S3_ENDPOINT_URL` | `${{Bucket.ENDPOINT}}` |
| `S3_REGION_NAME` | `${{Bucket.REGION}}` |
| `EMAIL_DELIVERY_PROVIDER` | `google_apps_script` for HTTPS delivery on Railway; local default is `smtp`. |
| `GOOGLE_APPS_SCRIPT_URL` | HTTPS URL of the deployed Apps Script Web App; enter only in Railway Variables. |
| `GOOGLE_APPS_SCRIPT_TOKEN` | Secret shared with Apps Script; enter only in Railway Variables. |
| `DEFAULT_FROM_EMAIL` | Sender display name and address. Apps Script controls the actual sending account. |

With `google_apps_script`, SMTP credentials are not required. For local SMTP development, keep `EMAIL_DELIVERY_PROVIDER=smtp` (or omit it) and configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, and `EMAIL_HOST_PASSWORD`. On Railway, SMTP mode still requires both SMTP credentials. The Apps Script endpoint must return JSON with `ok: true`; only the plain-text message body is sent, including for password-reset messages.

Railway provides `RAILWAY_ENVIRONMENT` and `PORT` automatically. When `RAILWAY_ENVIRONMENT` is present, Django requires private S3 storage, disables debug, uses Railway's HTTPS proxy header, redirects to HTTPS, enables secure session/CSRF cookies, and sets a short HSTS lifetime. Local `.env` and filesystem uploads continue to work without that variable. Uploaded files must never be placed in `STATIC_ROOT`; WhiteNoise serves only collected static assets.

## Frontend variables

| Variable | Railway value / purpose |
| --- | --- |
| `VITE_API_BASE_URL` | `https://<backend-hostname>/api/v1` (no trailing slash). |
| `VITE_GOOGLE_KEY` | Google Maps JavaScript API browser key, restricted to the Frontend origin and that API. |

`VITE_` values are embedded in the built JavaScript; the Maps key is not a server-side secret. Restrict it in Google Cloud. Google Maps production usage may require billing. Local-only `QARIB_DEV_HTTPS_CERT` and `QARIB_DEV_HTTPS_KEY` are not Railway variables.

## Validation before any deploy

Run the complete Django suite against a fresh `test_qarib_db` using `--settings=config.settings` only after verifying that test database does not already exist. Run frontend tests, lint, and build. Run `python manage.py check --deploy` with placeholder production environment values; this check does not migrate or write database data. Verify the exact Railway variables, domain, private bucket, and migration target before deployment. Railway's free plan has limited usage and storage; monitor it and arrange backups for the MySQL service and bucket.
