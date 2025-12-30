import { AnalysisResponse, Artifact } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export async function analyze(form: FormData): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Analyze failed: ${res.statusText}`);
  return res.json();
}

export async function requestDraft(payload: {
  thread_title: string;
  output_type: Artifact["output_type"];
  note: string;
}): Promise<{ draft: string }> {
  const body = new FormData();
  body.append("thread_title", payload.thread_title);
  body.append("output_type", payload.output_type);
  body.append("note", payload.note);
  const res = await fetch(`${API_BASE}/draft`, { method: "POST", body });
  if (!res.ok) throw new Error(`Draft failed: ${res.statusText}`);
  return res.json();
}

export async function saveArtifact(artifact: Artifact): Promise<Artifact> {
  const res = await fetch(`${API_BASE}/artifact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(artifact),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.statusText}`);
  return res.json();
}

export async function fetchArtifacts(): Promise<Artifact[]> {
  const res = await fetch(`${API_BASE}/artifacts`);
  if (!res.ok) throw new Error(`Load artifacts failed: ${res.statusText}`);
  const data = await res.json();
  return data.items;
}
