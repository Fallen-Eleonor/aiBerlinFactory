# Local Setup

## Backend

```bash
cd apps/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload
```

Default API base URL: `http://localhost:8000`

If the frontend runs on a different origin, set:

```env
STARTUP_OS_ALLOWED_ORIGINS=http://localhost:3000
```

## Frontend

```bash
cd apps/frontend
npm install
cp .env.example .env.local
npm run dev
```

Default frontend URL: `http://localhost:3000`

The frontend expects:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

## Flow

1. Submit the onboarding form on `/`
2. Frontend POSTs to `/api/analyze`
3. Frontend navigates to `/dashboard/{jobId}`
4. Dashboard listens to `/api/status/{jobId}` over SSE
5. Dashboard fetches `/api/result/{jobId}` when processing completes
