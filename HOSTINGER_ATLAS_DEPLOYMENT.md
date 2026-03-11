# DocuDB Deployment on Hostinger + MongoDB Atlas (`docudb.site`)

This runbook is for deploying:
- Frontend: `https://docudb.site`
- Backend API: `https://api.docudb.site`
- Database: MongoDB Atlas

## 1) Prepare the repository

This repo currently contains tracked `node_modules` and `server/uploads` files. That makes Git deploys heavy and slow.

Recommended cleanup before pushing:

```bash
git rm -r --cached node_modules server/node_modules client/node_modules server/uploads
git add .gitignore
git commit -m "chore: stop tracking dependencies and uploads"
```

## 2) Configure MongoDB Atlas

1. Create (or use) an Atlas cluster.
2. Create a database user (username/password).
3. Add network access for your backend host IP.
4. Copy the SRV connection string and replace credentials.

Connection string format:

```env
MONGO_URI=mongodb+srv://<db_user>:<db_password>@<cluster>.mongodb.net/docudb?retryWrites=true&w=majority&appName=DocuDB
```

## 3) Deploy backend (`api.docudb.site`)

Create a Hostinger Node.js app from this repo (backend root should be `server`).

Build/start:
- Install command: `npm ci --omit=dev`
- Build command: leave empty
- Start command: `npm start`

Set backend environment variables:

```env
PORT=3001
HOST=0.0.0.0
MONGO_URI=...atlas-uri...
FRONTEND_URL=https://docudb.site
CORS_ORIGINS=https://docudb.site,https://www.docudb.site
CORS_ALLOW_LAN=false

SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=no-reply@docudb.site
SMTP_PASS=<smtp_password>
SMTP_FROM_NAME=DocuDB
```

Attach domain/subdomain:
- Primary domain for API app: `api.docudb.site`

## 4) Deploy frontend (`docudb.site`)

Use Hostinger deployment for the `client` app.

Build settings:
- Install command: `npm ci`
- Build command: `npm run build`
- Publish directory: `dist`

Frontend environment variable:

```env
VITE_BACKEND_URL=https://api.docudb.site
```

Attach domain:
- Primary domain for frontend app: `docudb.site`
- Optional redirect: `www.docudb.site` -> `docudb.site`

## 5) Post-deploy checks

1. Open `https://api.docudb.site/login` with `GET` in browser or Postman.
2. Open `https://docudb.site` and log in.
3. Upload a test file and verify:
   - upload works
   - preview works
   - download works
4. If email notifications are enabled, trigger one test notification.

## 6) Common issues

- `CORS` error:
  - Confirm backend has `CORS_ORIGINS=https://docudb.site,https://www.docudb.site`
  - Redeploy backend after env changes

- Atlas connection timeout:
  - Add backend server IP in Atlas Network Access
  - Verify DB user/password in `MONGO_URI`

- Frontend still calling localhost:
  - Ensure frontend was rebuilt with `VITE_BACKEND_URL=https://api.docudb.site`

- Upload/preview broken after deploy:
  - Ensure backend app can write to `server/uploads`
  - This code now auto-creates uploads directory on startup
