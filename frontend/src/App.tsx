import { useEffect, useMemo, useRef, useState } from "react";
import { analyze, fetchArtifacts, requestDraft, saveArtifact } from "./api";
import { AnalysisResponse, Artifact, Thread } from "./types";
import { ARCard } from "./components/ARCard";

type LocationState = { lat: number; lon: number; accuracy?: number; timestamp?: number } | null;

const OUTPUT_TYPES: Artifact["output_type"][] = ["micro-story", "postcard", "performative-score"];

export default function App() {
  const [location, setLocation] = useState<LocationState>(null);
  const [locStatus, setLocStatus] = useState("Requesting GPS...");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [outputType, setOutputType] = useState<Artifact["output_type"]>("micro-story");
  const [draft, setDraft] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [arSupported, setArSupported] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [saving, setSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocation({ lat: latitude, lon: longitude, accuracy, timestamp: pos.timestamp });
        setLocStatus("Location acquired");
      },
      (err) => {
        setLocStatus(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    // Check WebXR availability.
    let cancelled = false;
    if (navigator.xr) {
      navigator.xr
        .isSessionSupported("immersive-ar")
        .then((supported) => !cancelled && setArSupported(supported))
        .catch(() => setArSupported(false));
    }
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchArtifacts()
      .then(setArtifacts)
      .catch(() => setArtifacts([]));
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 2);
    setPhotos(files);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Audio recording not supported.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => ev.data.size > 0 && chunks.push(ev.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      recorder.start();
      setRecording(true);
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 30000); // soft cap
    } catch (err) {
      setError(`Audio error: ${String(err)}`);
    }
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") {
      rec.stop();
    }
  };

  const submitAnalysis = async () => {
    if (!location) return;
    setLoadingAnalysis(true);
    setError(null);
    const form = new FormData();
    form.append("lat", String(location.lat));
    form.append("lon", String(location.lon));
    form.append("timestamp", String(location.timestamp || Date.now()));
    form.append("note", note);
    photos.forEach((file, idx) => form.append(`photo${idx + 1}`, file));
    if (audioBlob) form.append("audio", audioBlob, "ambient.webm");
    try {
      const result = await analyze(form);
      setAnalysis(result);
      setSelectedThread(result.threads[0]);
    } catch (err: unknown) {
      setError(`Analyze failed: ${String(err)}`);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const loadDraft = async () => {
    if (!selectedThread) return;
    setLoadingDraft(true);
    setError(null);
    try {
      const res = await requestDraft({ thread_title: selectedThread.title, output_type: outputType, note });
      setDraft(res.draft);
    } catch (err: unknown) {
      setError(`Draft failed: ${String(err)}`);
    } finally {
      setLoadingDraft(false);
    }
  };

  const save = async () => {
    if (!location || !selectedThread) return;
    setSaving(true);
    setError(null);
    const payload: Artifact = {
      location,
      note,
      output_type: outputType,
      thread_title: selectedThread.title,
      text: draft,
      place_label: analysis?.place_label,
    };
    try {
      const saved = await saveArtifact(payload);
      setArtifacts((prev) => [saved, ...prev]);
    } catch (err: unknown) {
      setError(`Save failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const supportLabel = useMemo(() => {
    if (!arSupported) return "AR not supported, using fallback list view.";
    return "AR available on this device.";
  }, [arSupported]);

  return (
    <div className="app">
      <h1>Portal</h1>
      <p>Place-based alternative-education tool: capture, reflect, and anchor context.</p>

      <div className="card">
        <div className="section-title">
          <h3>1. Check-in</h3>
          <span className="status">{locStatus}</span>
        </div>
        {location ? (
          <p>
            Lat {location.lat.toFixed(5)}, Lon {location.lon.toFixed(5)} (±{location.accuracy?.toFixed(1)}m)
          </p>
        ) : (
          <p>Waiting for location permission.</p>
        )}
      </div>

      <div className="card">
        <h3>2. Capture</h3>
        <div className="row">
          <div className="col">
            <p>Photos (take or select up to 2)</p>
            <input type="file" accept="image/*" multiple capture="environment" onChange={handlePhotoChange} />
            <div className="row">
              {photos.map((p, idx) => (
                <span key={p.name + idx} className="pill">
                  📷 {p.name}
                </span>
              ))}
            </div>
          </div>
          <div className="col">
            <p>Ambient audio (15-30s)</p>
            <div className="row">
              <button onClick={recording ? stopRecording : startRecording}>{recording ? "Stop" : "Record"}</button>
              {audioUrl && <audio src={audioUrl} controls />}
            </div>
            <small className="status">Recording auto-stops after ~30s.</small>
          </div>
        </div>
        <div className="col">
          <p>Field note</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="1–2 sentences..." />
        </div>
        <button disabled={!location || loadingAnalysis} onClick={submitAnalysis}>
          {loadingAnalysis ? "Analyzing..." : "Submit to AI backstage"}
        </button>
      </div>

      {analysis && (
        <div className="card">
          <div className="section-title">
            <h3>3. Threads</h3>
            <span className="status">{analysis.place_label}</span>
          </div>
          <div className="row">
            {analysis.threads.map((t) => (
              <div key={t.title} className="artifact-card" onClick={() => setSelectedThread(t)}>
                <strong>
                  {t.title}
                  <span className={`badge ${t.support_level}`}>{t.support_level}</span>
                </strong>
                <p>{t.summary}</p>
                <small>Sources: {t.suggested_sources.join(", ")}</small>
              </div>
            ))}
          </div>
          <div>
            <p>Reflection prompts</p>
            {analysis.reflection_prompts.map((p) => (
              <div key={p} className="pill">
                {p}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedThread && (
        <div className="card">
          <h3>4. Create artifact</h3>
          <div className="row">
            <div className="col">
              <label>Output type</label>
              <select value={outputType} onChange={(e) => setOutputType(e.target.value as Artifact["output_type"])}>
                {OUTPUT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="col">
              <button onClick={loadDraft} disabled={loadingDraft}>
                {loadingDraft ? "Loading draft..." : "Get suggested draft"}
              </button>
            </div>
          </div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Edit your artifact text..." />
          <button onClick={save} disabled={saving || !draft}>
            {saving ? "Saving..." : "Save artifact"}
          </button>
        </div>
      )}

      <div className="card">
        <div className="section-title">
          <h3>5. Saved artifacts</h3>
          <span className="status">{supportLabel}</span>
        </div>
        {artifacts.length === 0 ? (
          <p>No artifacts yet.</p>
        ) : (
          <div className="row">
            {artifacts.map((a) => (
              <div key={a.id} className="artifact-card">
                <strong>{a.thread_title}</strong>
                <p>{a.text}</p>
                <small>
                  {a.place_label || "Unknown place"} — {a.output_type} — {a.created_at}
                </small>
              </div>
            ))}
          </div>
        )}
      </div>

      {arSupported && selectedThread && (
        <ARCard title={selectedThread.title} preview={draft.slice(0, 140) || note} />
      )}

      {error && <p className="status">Error: {error}</p>}
    </div>
  );
}
