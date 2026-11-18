# Qarib frontend

Qarib is a responsive web application for citizens, organization representatives, and the system administrator. Citizens can submit and track complaints, while representatives manage complaints assigned to their organizations. This frontend connects to the Django backend for account and complaint data.

## Technology

The application uses React 19, React Router, Vite 8, Lucide icons, and `@react-google-maps/api` for complaint locations. Tests use Vitest and React Testing Library; Oxlint checks the source code.

## Run locally

Install a Node.js version supported by Vite 8, then run:

```powershell
cd qarib_frontend
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Start the Django backend separately on `http://127.0.0.1:8000`. Vite forwards `/api` requests to that backend during development. To open the frontend from a phone on the same network, use the computer's LAN address with Vite's port; the development server already listens on all interfaces.

## Environment variables

Copy `.env.example` to `.env.local` inside `qarib_frontend`, then fill in only the values you need. `.env.local` is ignored by Git. Never commit API keys, certificate private keys, or credentials.

| Variable | Purpose |
| --- | --- |
| `VITE_GOOGLE_KEY` | Google Maps JavaScript API key for selecting and viewing complaint locations. Configure appropriate key restrictions in Google Cloud. |
| `VITE_API_BASE_URL` | Optional API base URL; defaults to `/api/v1`, which uses the Vite development proxy. |
| `QARIB_DEV_HTTPS_CERT` | Optional path to a trusted local HTTPS certificate for phone testing. |
| `QARIB_DEV_HTTPS_KEY` | Optional path to its private key. Both HTTPS paths must be set together. |

Browser geolocation (the “current location” button) generally requires a secure context on a phone. Use trusted HTTPS when testing that feature over a LAN. The Google Maps key is exposed to the browser by design, so restrict it by website origin and enabled API; do not treat it as a server-side secret.

## Checks and production build

```powershell
npm run test
npm run lint
npm run build
```

The production bundle is written to `dist/`. Serve it with an `index.html` fallback for frontend paths. When Frontend and Backend use separate public domains, set `VITE_API_BASE_URL` to the Backend API URL during the build; a reverse proxy is only needed if you choose a same-origin deployment.

For Railway, use the build and start commands in [`../RAILWAY_DEPLOYMENT.md`](../RAILWAY_DEPLOYMENT.md). Set `VITE_API_BASE_URL` to the public Backend URL including `/api/v1` before building; the development proxy is not used in production.
