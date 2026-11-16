"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import PageHeader from "@/components/shell/PageHeader";
import { apiErrorMessage, apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RubricLevel {
  level: number;
  name: string;
  description: string;
  price: number;
  visual_cues: string[];
}

interface Rubric {
  id?: string; // set once saved, so assessments link to it
  name: string;
  service_type: string;
  levels: RubricLevel[];
  escalation_threshold: number;
}

interface AssessmentResult {
  assessment_id: string;
  condition_level: number;
  level_name: string;
  price_estimate: number;
  confidence: number;
  reasoning: string;
  key_observations: string[];
  escalated: boolean;
  escalation_reason?: string;
  model_used: string;
}

type ModelChoice = "gemini" | "gpt4o" | "claude";

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS: { value: ModelChoice; label: string; badge: string; free?: boolean }[] = [
  { value: "gemini", label: "Gemini 1.5 Flash", badge: "Free", free: true },
  { value: "gpt4o", label: "GPT-4o Mini", badge: "OpenAI" },
  { value: "claude", label: "Claude Haiku", badge: "Anthropic" },
];

const DEFAULT_RUBRIC: Rubric = {
  name: "Aircon General Service Rubric",
  service_type: "aircon",
  escalation_threshold: 0.6,
  levels: [
    {
      level: 1,
      name: "Clean / Light Dust",
      description: "Filter is mostly clean with light surface dust. Standard service sufficient.",
      price: 80,
      visual_cues: ["light grey coating", "fins still visible", "no blockage", "white or light colour overall"],
    },
    {
      level: 2,
      name: "Moderately Dirty",
      description: "Noticeable dust build-up, partial airflow restriction. Chemical wash recommended.",
      price: 120,
      visual_cues: ["thick dust layer", "some fins blocked", "brownish or grey tint", "dust clumps visible"],
    },
    {
      level: 3,
      name: "Heavily Soiled / Mouldy",
      description: "Severe contamination, possible mould. Full chemical overhaul required.",
      price: 180,
      visual_cues: ["black or green mould spots", "completely blocked fins", "slime or bio-film present", "dark colouring throughout"],
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceLabel(c: number) {
  if (c >= 0.8) return "High";
  if (c >= 0.6) return "Medium";
  if (c >= 0.4) return "Low";
  return "Very Low";
}

function confidenceColour(c: number) {
  if (c >= 0.75) return "text-emerald-600";
  if (c >= 0.55) return "text-amber-500";
  return "text-rose-500";
}

function confidenceBar(c: number) {
  if (c >= 0.75) return "bg-emerald-500";
  if (c >= 0.55) return "bg-amber-400";
  return "bg-rose-500";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuoteDemo() {
  const [tab, setTab] = useState<"rubric" | "assess">("rubric");
  const [rubric, setRubric] = useState<Rubric>(DEFAULT_RUBRIC);
  const [selectedModel, setSelectedModel] = useState<ModelChoice>("gemini");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveToDashboard, setSaveToDashboard] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Dropzone ──────────────────────────────────────────────────────────────

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
  });

  // ── API call ──────────────────────────────────────────────────────────────

  const handleAssess = async () => {
    if (!imageFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("rubric_json", JSON.stringify(rubric));
      fd.append("model", selectedModel);
      fd.append("save", String(saveToDashboard));

      const res = await apiFetch("/api/quotes/assess", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await apiErrorMessage(res));

      setResult(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  // Saves the rubric so the workflow builder's Quote node can pick it.
  const handleSaveRubric = async () => {
    setSaveStatus(null);
    try {
      const res = await apiFetch("/api/quotes/rubrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rubric),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res));
      const { id } = await res.json();
      setRubric((r) => ({ ...r, id }));
      setSaveStatus({ ok: true, message: "Rubric saved. You can now pick it in a Quote node." });
    } catch (e: unknown) {
      setSaveStatus({ ok: false, message: e instanceof Error ? e.message : "Save failed" });
    }
  };

  // ── Rubric helpers ────────────────────────────────────────────────────────

  const updateLevel = (index: number, field: keyof RubricLevel, value: unknown) => {
    const levels = rubric.levels.map((lvl, i) =>
      i === index ? { ...lvl, [field]: value } : lvl
    );
    setRubric({ ...rubric, levels });
  };

  const updateCues = (index: number, raw: string) => {
    updateLevel(index, "visual_cues", raw.split(",").map((s) => s.trim()).filter(Boolean));
  };

  const addLevel = () => {
    const next = rubric.levels.length + 1;
    setRubric({
      ...rubric,
      levels: [...rubric.levels, { level: next, name: "", description: "", price: 0, visual_cues: [] }],
    });
  };

  const removeLevel = (index: number) => {
    setRubric({
      ...rubric,
      levels: rubric.levels.filter((_, i) => i !== index).map((lvl, i) => ({ ...lvl, level: i + 1 })),
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Pricing Rubric"
        subtitle="Set your prices, then test how the AI quotes a customer photo"
        actions={
          <div role="group" aria-label="AI model" className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted">Model:</span>
            {MODELS.map((m) => (
              <button
                key={m.value}
                onClick={() => setSelectedModel(m.value)}
                aria-pressed={selectedModel === m.value}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-teal ${
                  selectedModel === m.value
                    ? "border-teal bg-teal text-white"
                    : "border-line bg-surface text-ink hover:border-teal"
                }`}
              >
                {m.label}
                {m.free && selectedModel !== m.value && <span className="ml-1 text-emerald-700">·free</span>}
              </button>
            ))}
          </div>
        }
      />

      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
        {/* Tabs */}
        <div className="flex bg-line/50 rounded-lg p-1 gap-1">
          {(["rubric", "assess"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                tab === t ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {t === "rubric" ? "① Define Rubric" : "② Assess Photo"}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Rubric Editor ── */}
        {tab === "rubric" && (
          <div className="space-y-5">
            <div className="bg-surface rounded-[10px] border border-line p-5 space-y-4">
              <h2 className="text-sm font-semibold text-ink uppercase tracking-wide">Rubric Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted">Rubric Name</label>
                  <input
                    type="text"
                    value={rubric.name}
                    onChange={(e) => setRubric({ ...rubric, name: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted">Service Type</label>
                  <input
                    type="text"
                    value={rubric.service_type}
                    onChange={(e) => setRubric({ ...rubric, service_type: e.target.value })}
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-muted">Escalation Threshold</label>
                  <span className={`text-sm font-mono font-bold ${confidenceColour(rubric.escalation_threshold)}`}>
                    {(rubric.escalation_threshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range" min="0.3" max="0.9" step="0.05"
                  value={rubric.escalation_threshold}
                  onChange={(e) => setRubric({ ...rubric, escalation_threshold: parseFloat(e.target.value) })}
                  className="w-full accent-teal"
                />
                <p className="text-xs text-muted">
                  If the model&apos;s confidence is below this, the job is escalated to a human agent.
                </p>
              </div>
            </div>

            {rubric.levels.map((lvl, i) => (
              <div key={i} className="bg-surface rounded-[10px] border border-line p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold bg-teal-soft text-teal-ink rounded-full w-7 h-7 flex items-center justify-center shrink-0">
                    {lvl.level}
                  </span>
                  <input
                    type="text" value={lvl.name}
                    onChange={(e) => updateLevel(i, "name", e.target.value)}
                    placeholder="Level name, e.g. Clean / Light Dust"
                    className="flex-1 border border-line rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-sm text-muted font-medium">RM</span>
                    <input
                      type="number" value={lvl.price}
                      onChange={(e) => updateLevel(i, "price", parseFloat(e.target.value))}
                      className="w-20 border border-line rounded-lg px-2 py-2 text-sm font-mono text-right focus:outline-none focus:ring-2 focus:ring-teal/30"
                    />
                  </div>
                  {rubric.levels.length > 1 && (
                    <button onClick={() => removeLevel(i)} aria-label="Remove this level" className="text-muted hover:text-rose-700 transition-colors text-lg leading-none">×</button>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">Condition Description</label>
                  <input
                    type="text" value={lvl.description}
                    onChange={(e) => updateLevel(i, "description", e.target.value)}
                    placeholder="Describe what this condition looks like..."
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted">
                    Visual Cues <span className="font-normal text-muted">— comma-separated; injected into the AI prompt</span>
                  </label>
                  <input
                    type="text" value={lvl.visual_cues.join(", ")}
                    onChange={(e) => updateCues(i, e.target.value)}
                    placeholder="e.g. light grey coating, fins visible, no blockage"
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30"
                  />
                  {lvl.visual_cues.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {lvl.visual_cues.map((cue, ci) => (
                        <span key={ci} className="text-xs bg-line/50 text-muted rounded-full px-2 py-0.5">{cue}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <button onClick={addLevel} className="flex-1 border-2 border-dashed border-line text-muted hover:border-teal hover:text-teal-ink rounded-lg py-3 text-sm font-medium transition-colors">
                + Add Level
              </button>
              <button onClick={handleSaveRubric} className="flex-1 border border-teal text-teal-ink hover:bg-teal-soft rounded-lg py-3 text-sm font-semibold transition-colors">
                Save rubric
              </button>
              <button onClick={() => setTab("assess")} className="flex-1 bg-teal text-white rounded-lg py-3 text-sm font-semibold hover:bg-teal/90 transition-colors">
                Next: Assess Photo →
              </button>
            </div>
            {saveStatus && (
              <p className={`text-sm ${saveStatus.ok ? "text-emerald-600" : "text-rose-600"}`}>{saveStatus.message}</p>
            )}
          </div>
        )}

        {/* ── Tab 2: Assess Photo ── */}
        {tab === "assess" && (
          <div className="space-y-5">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`bg-surface rounded-[10px] border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                isDragActive ? "border-teal bg-teal-soft" : "border-line hover:border-line"
              }`}
            >
              <input {...getInputProps()} />
              {imagePreview ? (
                <div className="space-y-3">
                  <img src={imagePreview} alt="Preview" className="max-h-56 mx-auto rounded-lg object-contain shadow-sm" />
                  <p className="text-xs text-muted">Click or drag to replace</p>
                </div>
              ) : (
                <div className="space-y-2 py-4">
                  <div className="text-5xl">📷</div>
                  <p className="text-muted font-medium">Drop customer photo here</p>
                  <p className="text-sm text-muted">JPEG · PNG · WebP — max 10 MB</p>
                </div>
              )}
            </div>

            {/* Active rubric + model summary */}
            <div className="bg-surface rounded-lg border border-line p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                  Active Rubric: {rubric.name}
                </p>
                <span className="text-xs bg-teal-soft text-teal-ink font-medium px-2 py-0.5 rounded-full">
                  {MODELS.find((m) => m.value === selectedModel)?.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {rubric.levels.map((lvl) => (
                  <span key={lvl.level} className="text-xs bg-page border border-line rounded-full px-3 py-1">
                    L{lvl.level}: {lvl.name} — RM{lvl.price}
                  </span>
                ))}
                <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1">
                  Escalate &lt; {(rubric.escalation_threshold * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={saveToDashboard}
                onChange={(e) => setSaveToDashboard(e.target.checked)}
                className="h-4 w-4 accent-teal"
              />
              Save the photo and result to my dashboard
            </label>

            {/* Submit */}
            <button
              onClick={handleAssess}
              disabled={!imageFile || loading}
              className="w-full bg-teal disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-3.5 font-semibold text-sm hover:bg-teal/90 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analysing with {MODELS.find((m) => m.value === selectedModel)?.label}…
                </>
              ) : (
                "Assess Photo →"
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">
                ⚠️ {error}
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`rounded-[10px] border-2 p-6 space-y-5 ${result.escalated ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
                {result.escalated && (
                  <div className="flex items-start gap-3 bg-surface border border-amber-200 rounded-lg p-4">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-amber-800 text-sm">Escalated to Human Agent</p>
                      <p className="text-amber-700 text-sm mt-1">{result.escalation_reason}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface rounded-lg p-4 border border-line">
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">Condition</p>
                    <p className="text-base font-bold text-ink">Level {result.condition_level}</p>
                    <p className="text-sm text-muted">{result.level_name}</p>
                  </div>
                  <div className="bg-surface rounded-lg p-4 border border-line">
                    <p className="text-xs text-muted uppercase tracking-wide mb-1">Price Estimate</p>
                    <p className="text-3xl font-bold text-teal-ink">RM{result.price_estimate}</p>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="bg-surface rounded-lg p-4 border border-line space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wide">Confidence</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        result.confidence >= 0.75 ? "bg-emerald-100 text-emerald-700"
                        : result.confidence >= 0.55 ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700"
                      }`}>
                        {confidenceLabel(result.confidence)}
                      </span>
                      <span className={`text-lg font-bold font-mono ${confidenceColour(result.confidence)}`}>
                        {(result.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2.5 bg-line/50 rounded-full overflow-hidden">
                    <div className="absolute top-0 bottom-0 w-px bg-slate-400 z-10"
                      style={{ left: `${rubric.escalation_threshold * 100}%` }} />
                    <div className={`h-full rounded-full transition-all duration-700 ${confidenceBar(result.confidence)}`}
                      style={{ width: `${result.confidence * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted">
                    Threshold at {(rubric.escalation_threshold * 100).toFixed(0)}% ·{" "}
                    {result.escalated ? "Below → human review" : "Above → auto-approved"}
                  </p>
                </div>

                {/* Model used */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">Assessed by</span>
                  <span className="text-xs bg-teal-soft text-teal-ink font-medium px-2 py-0.5 rounded-full">
                    {result.model_used}
                  </span>
                </div>

                {/* Reasoning */}
                <div className="bg-surface rounded-lg p-4 border border-line space-y-1.5">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">AI Reasoning</p>
                  <p className="text-sm text-ink leading-relaxed">{result.reasoning}</p>
                </div>

                {/* Observations */}
                {result.key_observations.length > 0 && (
                  <div className="bg-surface rounded-lg p-4 border border-line space-y-2">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">Key Observations</p>
                    <ul className="space-y-1.5">
                      {result.key_observations.map((obs, i) => (
                        <li key={i} className="text-sm text-ink flex items-start gap-2">
                          <span className="text-teal-ink mt-0.5 shrink-0">→</span>{obs}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-muted">Assessment ID: {result.assessment_id}</p>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}