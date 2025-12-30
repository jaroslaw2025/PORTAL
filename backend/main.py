from datetime import datetime
from typing import Dict, List, Optional
import uuid

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


app = FastAPI(title="Portal AI Backstage", version="0.1.0")

# Enable CORS for local dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ArtifactStore:
    """Simple in-memory store for prototype artifacts."""

    def __init__(self) -> None:
        self._items: Dict[str, Dict] = {}

    def add(self, payload: Dict) -> Dict:
        artifact_id = str(uuid.uuid4())
        payload["id"] = artifact_id
        payload["created_at"] = datetime.utcnow().isoformat() + "Z"
        self._items[artifact_id] = payload
        return payload

    def list(self) -> List[Dict]:
        return list(self._items.values())

    def get(self, artifact_id: str) -> Dict:
        if artifact_id not in self._items:
            raise KeyError(artifact_id)
        return self._items[artifact_id]


store = ArtifactStore()


def synthetic_place_label(lat: float, lon: float) -> str:
    coastal = abs(lon) < 20 or abs(lat) < 15
    river_band = 36.0 < lat < 41.0 and -10.0 < lon < -4.0  # loose Tagus-like band
    if river_band:
        return f"Riverside bend near ({lat:.3f}, {lon:.3f})"
    if coastal:
        return f"Coastal fringe around ({lat:.3f}, {lon:.3f})"
    return f"Inland ridge near ({lat:.3f}, {lon:.3f})"


def build_threads(lat: float, lon: float, note: str) -> List[Dict]:
    threads = []
    is_coastal = abs(lon) < 20 or abs(lat) < 15
    river_band = 36.0 < lat < 41.0 and -10.0 < lon < -4.0
    base_questions = [
        "Who else keeps records of this place?",
        "What photos or maps could confirm details?",
        "Which community voices are missing here?",
    ]

    if river_band:
        threads.append(
            {
                "title": "River trade and tides",
                "summary": "Merchant rafts once drifted here; floods rewrote paths and stories.",
                "support_level": "supported",
                "suggested_sources": ["Port records", "Oral histories", "Tide charts"],
                "verify_questions": base_questions,
            }
        )
        threads.append(
            {
                "title": "Bridge rumors",
                "summary": "Locals speak of a temporary bridge that appeared only at low tide.",
                "support_level": "likely",
                "suggested_sources": ["Newspaper clippings", "Municipal minutes"],
                "verify_questions": base_questions,
            }
        )
    elif is_coastal:
        threads.append(
            {
                "title": "Salt wind archive",
                "summary": "Fisher cooperatives indexed storms with shells strung above doorways.",
                "support_level": "likely",
                "suggested_sources": ["Family collections", "Weather logs"],
                "verify_questions": base_questions,
            }
        )
        threads.append(
            {
                "title": "Ship graffiti",
                "summary": "Hull markings carved by dockworkers doubled as secret navigation rhymes.",
                "support_level": "speculative",
                "suggested_sources": ["Harbor walls", "Retired sailors"],
                "verify_questions": base_questions,
            }
        )
    else:
        threads.append(
            {
                "title": "Dry season crossings",
                "summary": "Caravans cut through here when the marshes shrank; stones still mark the line.",
                "support_level": "supported",
                "suggested_sources": ["Trail maps", "Satellite imagery"],
                "verify_questions": base_questions,
            }
        )
        threads.append(
            {
                "title": "Songs against dust",
                "summary": "Field choirs sang call-and-response to time irrigation releases.",
                "support_level": "likely",
                "suggested_sources": ["Local elders", "Radio archives"],
                "verify_questions": base_questions,
            }
        )

    threads.append(
        {
            "title": "Overlay of legends",
            "summary": f"A traveler wrote about this spot in a note: '{note[:80]}...' and added their own myth.",
            "support_level": "speculative",
            "suggested_sources": ["Personal journals", "Community forums"],
            "verify_questions": base_questions,
        }
    )
    return threads


def build_prompts(lat: float, lon: float) -> List[str]:
    return [
        "What sounds did you hear that others might miss?",
        "How does the light or fog change the story of this place?",
        f"What would someone 50km away assume about ({lat:.2f}, {lon:.2f}) and how could you correct them?",
    ]


@app.post("/analyze")
async def analyze(
    lat: float = Form(...),
    lon: float = Form(...),
    timestamp: Optional[str] = Form(None),
    note: str = Form(""),
    photo1: Optional[UploadFile] = File(None),
    photo2: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
):
    place_label = synthetic_place_label(lat, lon)
    threads = build_threads(lat, lon, note)
    reflection_prompts = build_prompts(lat, lon)
    aesthetic = {"mood": "documentary-poetic", "style_tokens": ["grainy", "local", "unhurried"]}

    # We don't persist uploads in this prototype; keep filenames for traceability.
    uploads = {
        "photo_names": [f.filename for f in [photo1, photo2] if f],
        "audio_name": audio.filename if audio else None,
    }
    return {
        "place_label": place_label,
        "threads": threads,
        "reflection_prompts": reflection_prompts,
        "aesthetic": aesthetic,
        "uploads": uploads,
        "received_at": datetime.utcnow().isoformat() + "Z",
        "timestamp": timestamp,
    }


@app.post("/draft")
async def draft(
    thread_title: str = Form(...),
    output_type: str = Form(...),
    note: str = Form(""),
):
    base = f"From {thread_title}, your note hints: {note[:100]}"
    if output_type == "micro-story":
        text = (
            f"{base}. A passerby pauses as wind drags the scent of metal and salt. "
            "Layers of rumor and record fold together in 140 words of compressed time."
        )
    elif output_type == "postcard":
        text = f"Caption: {base}. Source note: drafted by the Portal AI backstage, please verify locally."
    else:
        text = (
            "Score: (1) Map a path with footsteps, pause at every third stride. "
            "(2) Whisper the place name and your note. "
            "(3) Offer a gesture toward the nearest landmark."
        )
    return {"draft": text, "output_type": output_type, "thread_title": thread_title}


@app.post("/artifact")
async def save_artifact(payload: Dict):
    saved = store.add(payload)
    return saved


@app.get("/artifacts")
async def list_artifacts():
    return {"items": store.list()}


@app.get("/artifact/{artifact_id}")
async def get_artifact(artifact_id: str):
    try:
        item = store.get(artifact_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return item


@app.get("/health")
async def health():
    return JSONResponse({"status": "ok"})
