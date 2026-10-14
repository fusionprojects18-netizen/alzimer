# MindBridge

AI-assisted Alzheimer's screening app. Patients fill in a clinical questionnaire
(optionally autofilled from a reference dataset, optionally with an MRI scan),
get an instant risk prediction, and a doctor reviews and signs off on the
result.

## Architecture

Three services:

| Service | Tech | Responsibility |
|---|---|---|
| `alzimer-frontend` (frontend) | React + Vite | UI |
| `alzimer-frontend/server.js` (node-api) | Express | Auth, Firestore CRUD |
| `alzimer_backend` (ml-api) | FastAPI | ML inference (XGBoost + ResNet50 CNN) |

Firebase Firestore is the database (via `firebase-admin` in `server.js`). The
two backend services share a JWT secret: the Node API issues tokens on
login/register, and the FastAPI service verifies them on every ML request.

```
Browser ──► node-api (Express, port 5000) ──► Firestore
   │
   └──────► ml-api (FastAPI, port 8000)
```

## Local setup

```bash
# 1. Node API + frontend
cd alzimer-frontend
npm install
cp .env.example .env   # fill in Firebase creds + a random JWT_SECRET
npm run server         # starts the Express API on :5000
npm run dev            # in a second terminal, starts Vite on :5173

# 2. ML API
cd alzimer_backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env   # JWT_SECRET must match alzimer-frontend's .env exactly
python main.py         # starts FastAPI on :8000
```

Vite's dev server proxies `/api`, `/predict`, and `/patient-record` to the two
backend ports automatically (see `vite.config.js`) — you don't need
`VITE_API_URL` / `VITE_ML_API_URL` set for local dev.

### Seeding sample doctor accounts

Patients pick a doctor at registration, so you need at least one in Firestore:

```bash
cd alzimer-frontend
npm run seed:doctors
```

This prints each generated password once — save them, they aren't stored
anywhere. (There used to be a public `/api/seed-doctors` HTTP route for this;
it's been removed since shipping an unauthenticated endpoint that creates
accounts is a real liability in production.)

## The CNN model file

`alzimer_backend/alzheimer_cnn_model.pkl` is ~94MB — too large for GitHub's
web "Upload files" UI (25MB/file limit) and for a vanilla `git add` without
Git LFS, so it's excluded via `.gitignore` and **not included in this repo**.

Two ways to get it onto a deployment:

1. **GitHub Release asset** (recommended — no LFS billing, works with Render):
   create a Release on your GitHub repo and attach the `.pkl` file there
   (Releases allow up to 2GB per asset). Then set `CNN_MODEL_URL` to the
   asset's download URL — `alzimer_backend/main.py` downloads it on first
   boot if it isn't already present locally.
2. Place the file directly at `alzimer_backend/alzheimer_cnn_model.pkl` on
   the machine/container (e.g. via a persistent disk you upload to once).

## Deploying (Vercel + Render + Firebase)

**Firebase** — already the database; nothing to deploy, just use the same
project's service account credentials everywhere below.

**Render — node-api** (new Web Service, root directory `alzimer-frontend`):
- Build command: `npm install`
- Start command: `npm run server`
- Env vars: everything in `alzimer-frontend/.env.example` — real Firebase
  creds, a strong random `JWT_SECRET`, and `FRONTEND_URL` set to your Vercel
  production URL (e.g. `https://mindbridge.vercel.app`).

**Render — ml-api** (second new Web Service, root directory `alzimer_backend`):
- Build command: `pip install -r requirements-render.txt` (not `requirements.txt` —
  that one pulls in the GPU/CUDA build of torch, which is both useless and a
  large chunk of extra memory on a CPU-only instance; `requirements-render.txt`
  installs the CPU-only build instead)
- Start command: `python main.py`
- Env vars: everything in `alzimer_backend/.env.example` — **`JWT_SECRET` must
  be the exact same value as node-api's**, `CORS_ORIGINS` set to your Vercel
  URL, and `CNN_MODEL_URL` (see above) unless you've placed the file manually.
- Python version: Render defaults to its latest Python image, which is often
  too new to have prebuilt wheels for pinned versions like `torch==2.6.0` —
  the build then falls back to compiling from source (very slow) and can
  still fail outright. `alzimer_backend/.python-version` pins it to `3.11.9`,
  which Render should pick up automatically from the service's root
  directory; if it doesn't, set the `PYTHON_VERSION` env var to `3.11.9`
  explicitly in the service's dashboard.
- Note: Render's free tier spins services down on idle. The first request
  after idle will be slow (PyTorch + ResNet50 loading on cold start).
- Memory: this service loads PyTorch, torchvision, a ResNet50 CNN, XGBoost,
  pandas, and scikit-learn into one process — it can be tight on Render's
  free 512MB instance even with the CPU-only torch build above. If you see
  `Out of memory` in the deploy log, either move this service to a plan with
  more RAM (1GB+ is a safer baseline for this stack), or deploy it to
  Hugging Face Spaces instead (see below) — its free tier gives 16GB RAM.

### Alternative: ml-api on Hugging Face Spaces instead of Render

If Render's free tier can't fit this service in memory, Hugging Face Spaces
(Docker SDK) is a better home for it specifically — free tier gives 16GB RAM
instead of 512MB, and its upload UI isn't capped at 25MB/file, so the CNN
model can just be committed directly (no `CNN_MODEL_URL` workaround needed).

Everything needed is pre-built in a sibling folder, `MindBridge-ml-api-space/`
(not part of this repo — Spaces are their own git repos). It already includes
`alzheimer_cnn_model.pkl` directly. To deploy:

1. Create a new Space on huggingface.co → SDK: **Docker**.
2. Push/upload the entire contents of `MindBridge-ml-api-space/` as that
   Space's files (its `README.md` has the `sdk: docker` / `app_port: 7860`
   metadata Spaces require, and its `Dockerfile` builds and runs the service).
3. In the Space's **Settings → Variables and secrets**, add `JWT_SECRET`
   (as a Secret, identical to node-api's) and `CORS_ORIGINS` (as a Variable,
   your Vercel URL).
4. Once it's running, copy the Space's public URL
   (`https://<user>-<space-name>.hf.space`) into `VITE_ML_API_URL` on Vercel.

node-api still runs on Render as described above — only ml-api moves.

**Vercel — frontend** (root directory `alzimer-frontend`):
- Build command: `npm run build`, output directory: `dist`
- Env vars: `VITE_API_URL` = your node-api Render URL + `/api`
  (e.g. `https://mindbridge-api.onrender.com/api`), and `VITE_ML_API_URL` =
  your ml-api Render URL (e.g. `https://mindbridge-ml.onrender.com`).
- These are baked in at build time, so set them in Vercel's dashboard
  *before* deploying, not just in a local `.env`.

Note: Vercel preview deployments get a unique, unpredictable URL per deploy —
they won't be in `FRONTEND_URL` / `CORS_ORIGINS`, so ML/API calls will be
CORS-blocked on previews unless you add that preview URL too. This is only
relevant if you rely on preview deployments; production deploys at your fixed
domain work as configured above.

## Security notes

- Secrets live only in `.env` files (gitignored) or your host's env var
  dashboard — never in code. `.env.example` files have no real values.
- `JWT_SECRET` must be identical between `alzimer-frontend` and
  `alzimer_backend` — it's how the FastAPI service trusts tokens issued by
  the Node API.
- Doctor registration (`POST /api/auth/doctor/register`) is currently open to
  anyone who hits the endpoint — same as patient registration. If you need to
  restrict who can register as a doctor in a real deployment, add an
  approval/verification step before relying on this for real patients.

## Repo layout

```
alzimer-frontend/   React UI + Express API (server.js)
alzimer_backend/    FastAPI ML service
alzheimers_disease_data.csv   Reference dataset (used by the "autofill by
                              PatientID/row number" feature and originally
                              for model training)
alzheimer_xgboost_model.pkl   Clinical-data model (small, included)
docs/                Reference docs (CNN model notes, project overview)
training/            Original training/prediction scripts (not run in
                     production — the trained models are already included)
```
