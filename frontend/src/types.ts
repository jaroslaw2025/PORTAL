export type Thread = {
  title: string;
  summary: string;
  support_level: "supported" | "likely" | "speculative";
  suggested_sources: string[];
  verify_questions: string[];
};

export type AnalysisResponse = {
  place_label: string;
  threads: Thread[];
  reflection_prompts: string[];
  aesthetic: { mood: string; style_tokens: string[] };
  uploads?: { photo_names: string[]; audio_name?: string | null };
  received_at?: string;
};

export type Artifact = {
  id?: string;
  created_at?: string;
  location: { lat: number; lon: number; accuracy?: number; timestamp?: number };
  note: string;
  output_type: "micro-story" | "postcard" | "performative-score";
  thread_title: string;
  text: string;
  place_label?: string;
};
