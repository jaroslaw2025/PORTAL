# Portal AR Prototype

Browser-based, Android-first WebXR AR "PORTAL" MVP. Capture place data (GPS, photos, ambient audio, note), get contextual threads from a Python FastAPI backend, create an artifact, and (where supported) pin it as an AR context card via WebXR hit-test. Falls back to a non-AR list view on unsupported devices.

## Repo layout
- `backend/` – FastAPI server with deterministic placeholder "AI backstage"
- `frontend/` – React + TypeScript + Vite PWA-ready client with WebXR + fallbacks

## Prereqs
- Node 18+ and npm
- Python 3.10+ (for FastAPI)

## Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Endpoints:
- `POST /analyze` (multipart: lat, lon, timestamp, note, optional photo1/photo2/audio) → synthetic threads + prompts
- `POST /draft` (thread_title, output_type, note) → suggested draft text
- `POST /artifact` (JSON artifact payload) → saves to in-memory store
- `GET /artifacts`, `GET /artifact/{id}`, `GET /health`

No external APIs are called; logic is deterministic and rule-based.

## Frontend (Vite React TS)
```bash
cd frontend
npm install
npm run dev -- --host
# open the printed URL (e.g., http://localhost:5173)
```

Environment:
- `VITE_API_BASE` (default `http://localhost:8000`)

Features:
- GPS check-in with permission handling
- Capture 2 photos (camera/file) + 15–30s ambient audio (MediaRecorder) + short note
- Submit to backend for contextual threads + reflection prompts
- Choose output format (micro-story / postcard / performative score), fetch editable draft, save artifact
- Non-AR fallback list of artifacts
- WebXR AR mode (Android Chrome + ARCore): detects support, enters immersive AR, plane hit-test, tap to place a "context card" billboard anchored to the surface

## Demo script (Android ARCore device, Chrome)
1. Start backend (`uvicorn main:app --reload --host 0.0.0.0 --port 8000`).
2. Start frontend (`npm run dev -- --host`) and open the LAN URL on the phone.
3. Allow GPS and camera/mic permissions. Verify coordinates shown.
4. Capture two quick photos and record ~15 seconds of ambient audio. Add a short note.
5. Tap "Submit to AI backstage" → threads + prompts appear.
6. Select a thread, choose format, fetch "Get suggested draft", tweak text, then "Save artifact".
7. Scroll to "Saved artifacts". If AR is supported, tap "Enter AR", scan for a surface, then tap to place the context card billboard. Move around to confirm it stays anchored. If AR is unavailable, review artifacts in the list view.

## Notes
- Storage is in-memory only (prototype). Uploads are not persisted; filenames are echoed back.
- WebXR is only available over HTTPS or localhost; on-device testing should use LAN URL with `--host` or tunneled HTTPS.
- The UI is mobile-first; works on desktop with non-AR flow.
