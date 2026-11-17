"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  X,
} from "lucide-react";
import PageHeader from "@/components/shell/PageHeader";
import { apiErrorMessage, apiFetch } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RubricLevel {
  level: number;
  name: string;
  description: string;
  price: number; // the price, or the lowest price of a range
  price_max?: number | null; // set for a range, e.g. RM120–RM180
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
  price_min?: number | null;
  price_max?: number | null;
  confidence: number;
  reasoning: string;
  key_observations: string[];
  escalated: boolean;
  escalation_reason?: string;
  model_used: string;
}

type ModelChoice = "gemini" | "gpt4o" | "claude";

// ── Constants ─────────────────────────────────────────────────────────────────

// Labels match the model IDs the backend calls (routers/quotes.py MODEL_LABELS).
const MODELS: { value: ModelChoice; label: string }[] = [
  { value: "gpt4o", label: "GPT-4o Mini" },
  { value: "gemini", label: "Gemini 2.0 Flash" },
  { value: "claude", label: "Claude Haiku 4.5" },
];

const DEFAULT_RUBRIC: Rubric = {
  name: "Aircon General Service Rubric",
  service_type: "aircon",
  escalation_threshold: 0.75,
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
      price_max: 150,
      visual_cues: ["thick dust layer", "some fins blocked", "brownish or grey tint", "dust clumps visible"],
    },
    {
      level: 3,
      name: "Heavily Soiled / Mouldy",
      description: "Severe contamination, possible mould. Full chemical overhaul required.",
      price: 180,
      price_max: 250,
      visual_cues: ["black or green mould spots", "completely blocked fins", "slime or bio-film present", "dark colouring throughout"],
    },
  ],
};

const TABS = [
  { id: "rubric", label: "1. Set your prices" },
  { id: "assess", label: "2. Test with a photo" },
] as const;

// ── Styles (DESIGN.md: ruled cards, one black primary action per area) ────────

const card = "rounded-[10px] border border-line bg-surface";
const inputClass =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/30";
const labelClass = "text-xs font-medium text-ink";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-on hover:bg-brand/80 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-brand disabled:hover:shadow-none";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-brand-soft hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand";

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceLabel(c: number) {
  if (c >= 0.8) return "High";
  if (c >= 0.6) return "Medium";
  if (c >= 0.4) return "Low";
  return "Very low";
}

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

/** RM80, or RM120–RM150 for a range. */
const priceText = (min: number, max?: number | null) =>
  max != null && max > min ? `RM${min}–RM${max}` : `RM${min}`;

const splitCues = (raw: string) => raw.split(/[\n,]/).map((c) => c.trim()).filter(Boolean);

/** Keeps the raw text while typing (so commas and new lines aren't swallowed) and reports the list. */
function CuesInput({
  id,
  cues,
  onChange,
  describedBy,
}: {
  id: string;
  cues: string[];
  onChange: (cues: string[]) => void;
  describedBy: string;
}) {
  const [raw, setRaw] = useState(() => cues.join("\n"));
  // A level was removed or reset elsewhere: show its cues instead of stale text.
  const [shown, setShown] = useState(cues);
  if (cues !== shown) {
    setShown(cues);
    if (splitCues(raw).join("|") !== cues.join("|")) setRaw(cues.join("\n"));
  }
  return (
    <textarea
      id={id}
      rows={Math.max(3, cues.length)}
      value={raw}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange(splitCues(e.target.value));
      }}
      placeholder={"e.g.\nlight grey coating\nfins still visible"}
      aria-describedby={describedBy}
      className={`${inputClass} resize-y`}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuoteDemo() {
  const [tab, setTab] = useState<"rubric" | "assess">("rubric");
  const [rubric, setRubric] = useState<Rubric>(DEFAULT_RUBRIC);
  const [selectedModel, setSelectedModel] = useState<ModelChoice>("gpt4o");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveToDashboard, setSaveToDashboard] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const saveStatusRef = useRef<HTMLDivElement>(null);
  // Bring the save result (and the "Create a chatbot" button) into view: the buttons sit at the page bottom.
  useEffect(() => {
    if (saveStatus) saveStatusRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [saveStatus]);

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

  // Saves the rubric so the workflow builder's Photo Quote step can pick it.
  const handleSaveRubric = async () => {
    setSaveStatus(null);
    setSaving(true);
    try {
      const res = await apiFetch("/api/quotes/rubrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rubric),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res));
      const { id } = await res.json();
      setRubric((r) => ({ ...r, id }));
      setSaveStatus({ ok: true, message: "Rubric saved. Next, turn it into a WhatsApp chatbot. You can also pick it in any Photo Quote step." });
    } catch (e: unknown) {
      setSaveStatus({ ok: false, message: `Couldn’t save the rubric. ${e instanceof Error ? e.message : ""}`.trim() });
    } finally {
      setSaving(false);
    }
  };

  // ── Rubric helpers ────────────────────────────────────────────────────────

  const updateLevel = (index: number, field: keyof RubricLevel, value: unknown) => {
    const levels = rubric.levels.map((lvl, i) =>
      i === index ? { ...lvl, [field]: value } : lvl
    );
    setRubric({ ...rubric, levels });
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
        subtitle="Set your prices for each condition, then test how the AI quotes a customer’s photo"
      />

      <main className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
        {/* Tabs */}
        <div role="tablist" aria-label="Pricing rubric steps" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-md py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand ${
                tab === t.id ? "bg-brand text-brand-on" : "text-muted hover:bg-brand-soft hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Rubric editor ── */}
        {tab === "rubric" && (
          <div id="panel-rubric" role="tabpanel" aria-labelledby="tab-rubric" className="space-y-5">
            <section className={`${card} space-y-4 p-5`} aria-labelledby="rubric-details">
              <h2 id="rubric-details" className="text-sm font-semibold text-ink">
                Rubric details
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="rubric-name" className={labelClass}>
                    Rubric name
                  </label>
                  <input
                    id="rubric-name"
                    type="text"
                    value={rubric.name}
                    onChange={(e) => setRubric({ ...rubric, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="rubric-service" className={labelClass}>
                    Service
                  </label>
                  <input
                    id="rubric-service"
                    type="text"
                    value={rubric.service_type}
                    onChange={(e) => setRubric({ ...rubric, service_type: e.target.value })}
                    placeholder="e.g. aircon"
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="space-y-2 border-t border-divider pt-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="confidence-level" className={labelClass}>
                    Confidence level for sending quotes
                  </label>
                  <span className="text-sm font-semibold tabular-nums text-ink">{pct(rubric.escalation_threshold)}</span>
                </div>
                <input
                  id="confidence-level"
                  type="range"
                  min="0.3"
                  max="0.9"
                  step="0.05"
                  value={rubric.escalation_threshold}
                  onChange={(e) => setRubric({ ...rubric, escalation_threshold: parseFloat(e.target.value) })}
                  className="w-full accent-brand"
                />
                <p className="text-xs text-muted">
                  If the AI is less sure than this, the quote comes to you for review instead of going straight to the
                  customer. Higher means you check more quotes yourself.
                </p>
              </div>
            </section>

            {rubric.levels.map((lvl, i) => (
              <section key={i} className={`${card} space-y-4 p-5`} aria-label={`Level ${lvl.level}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-on"
                    aria-hidden
                  >
                    {lvl.level}
                  </span>
                  <input
                    type="text"
                    value={lvl.name}
                    onChange={(e) => updateLevel(i, "name", e.target.value)}
                    placeholder="Name, e.g. Clean / Light Dust"
                    aria-label={`Level ${lvl.level} name`}
                    className={`${inputClass} min-w-40 flex-1 font-medium`}
                  />
                  <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={`Level ${lvl.level} price`}>
                    <span className="text-sm font-medium text-muted" aria-hidden>
                      RM
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={lvl.price}
                      onChange={(e) => updateLevel(i, "price", parseFloat(e.target.value))}
                      aria-label={`Level ${lvl.level} price in RM (or lowest price)`}
                      className={`${inputClass} w-20 text-right tabular-nums`}
                    />
                    <span className="text-sm text-muted">to</span>
                    <input
                      type="number"
                      min={0}
                      value={lvl.price_max ?? ""}
                      placeholder="—"
                      onChange={(e) =>
                        updateLevel(i, "price_max", e.target.value === "" ? null : parseFloat(e.target.value))
                      }
                      aria-label={`Level ${lvl.level} highest price in RM (optional)`}
                      title="Optional. Leave empty for one fixed price."
                      className={`${inputClass} w-20 text-right tabular-nums`}
                    />
                  </div>
                  {rubric.levels.length > 1 && (
                    <button
                      onClick={() => removeLevel(i)}
                      aria-label={`Remove level ${lvl.level}`}
                      title="Remove this level"
                      className="rounded-md p-1.5 text-muted hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-600"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`level-${i}-desc`} className={labelClass}>
                    What this condition looks like
                  </label>
                  <input
                    id={`level-${i}-desc`}
                    type="text"
                    value={lvl.description}
                    onChange={(e) => updateLevel(i, "description", e.target.value)}
                    placeholder="e.g. Noticeable dust build-up. Chemical wash recommended."
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`level-${i}-cues`} className={labelClass}>
                    Signs to spot in the photo
                  </label>
                  <CuesInput
                    id={`level-${i}-cues`}
                    cues={lvl.visual_cues}
                    onChange={(cues) => updateLevel(i, "visual_cues", cues)}
                    describedBy={`level-${i}-cues-hint`}
                  />
                  <p id={`level-${i}-cues-hint`} className="text-xs text-muted">
                    One sign per line (or separate with commas). The AI looks for these in the customer’s photo.
                  </p>
                  {lvl.visual_cues.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 pt-1" aria-label="Signs the AI looks for">
                      {lvl.visual_cues.map((cue, ci) => (
                        <li key={ci} className="rounded-full border border-divider bg-brand-soft px-2 py-0.5 text-xs text-ink">
                          {cue}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button onClick={addLevel} className={`${secondaryButton} sm:flex-1`}>
                <Plus className="h-4 w-4" aria-hidden />
                Add a level
              </button>
              <button onClick={() => setTab("assess")} className={`${secondaryButton} sm:flex-1`}>
                Next: test with a photo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button onClick={handleSaveRubric} disabled={saving} className={`${primaryButton} sm:flex-1`}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                {saving ? "Saving…" : "Save rubric"}
              </button>
            </div>
            {saveStatus && (
              <div
                ref={saveStatusRef}
                role={saveStatus.ok ? "status" : "alert"}
                className={`animate-arrive flex items-start gap-3 rounded-[10px] border p-4 text-sm ${
                  saveStatus.ok ? "border-line bg-surface text-ink" : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {saveStatus.ok ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="block space-y-3">
                  <span className="block font-medium">{saveStatus.message}</span>
                  {saveStatus.ok && rubric.id && (
                    <Link
                      href={`/builder?${new URLSearchParams({
                        template: "photo-quote",
                        rubric: rubric.id,
                        rubricName: rubric.name,
                        service: rubric.service_type,
                      })}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-on hover:bg-brand/80 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      Create a chatbot from this rubric
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  )}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Test with a photo ── */}
        {tab === "assess" && (
          <div id="panel-assess" role="tabpanel" aria-labelledby="tab-assess" className="space-y-5">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-[10px] border-2 border-dashed p-8 text-center transition-colors focus-visible:ring-2 focus-visible:ring-brand ${
                isDragActive ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-brand-soft/60"
              }`}
            >
              <input {...getInputProps()} aria-label="Customer photo" />
              {imagePreview ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a chosen file */}
                  <img src={imagePreview} alt="The photo you chose" className="mx-auto max-h-56 rounded-lg border border-line object-contain" />
                  <p className="text-xs text-muted">Click or drop another photo to replace it</p>
                </div>
              ) : (
                <div className="space-y-2 py-4">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface" aria-hidden>
                    <Camera className="h-6 w-6 text-ink" />
                  </span>
                  <p className="font-medium text-ink">Drop a customer’s photo here, or click to choose one</p>
                  <p className="text-sm text-muted">JPG, PNG or WebP, up to 10 MB</p>
                </div>
              )}
            </div>

            {/* Rubric being used */}
            <section className={`${card} space-y-3 p-4`} aria-labelledby="active-rubric">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="active-rubric" className="text-sm font-semibold text-ink">
                  Using: {rubric.name}
                </h2>
                <label className="flex items-center gap-2 text-xs text-muted">
                  AI model
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as ModelChoice)}
                    className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink hover:bg-brand-soft focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    {MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ul className="flex flex-wrap gap-2">
                {rubric.levels.map((lvl) => (
                  <li key={lvl.level} className="rounded-full border border-line px-3 py-1 text-xs text-ink">
                    {lvl.name || `Level ${lvl.level}`} · <span className="tabular-nums">{priceText(lvl.price, lvl.price_max)}</span>
                  </li>
                ))}
                <li className="rounded-full border border-dashed border-line px-3 py-1 text-xs text-muted">
                  You review if the AI is under {pct(rubric.escalation_threshold)} sure
                </li>
              </ul>
            </section>

            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={saveToDashboard}
                onChange={(e) => setSaveToDashboard(e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              Save the photo and result to my Overview
            </label>

            <button onClick={handleAssess} disabled={!imageFile || loading} className={`${primaryButton} w-full py-3`}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Checking the photo…
                </>
              ) : (
                <>
                  Get AI quote
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>

            {error && (
              <p role="alert" className="animate-arrive flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>Couldn’t check this photo. {error}</span>
              </p>
            )}

            {result && <Result result={result} threshold={rubric.escalation_threshold} />}
          </div>
        )}
      </main>
    </>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────

function Result({ result, threshold }: { result: AssessmentResult; threshold: number }) {
  return (
    <section className={`animate-arrive ${card} overflow-hidden`} aria-labelledby="quote-result" aria-live="polite">
      {/* Outcome: needs attention is shown inverted (wash + dark rule), not with a new hue */}
      <header
        className={`flex items-start gap-3 border-b px-5 py-4 ${
          result.escalated ? "border-highlight-line bg-highlight" : "border-divider"
        }`}
      >
        {result.escalated ? (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
        )}
        <div className="space-y-0.5">
          <h2 id="quote-result" className="text-sm font-semibold text-ink">
            {result.escalated ? "Needs your review" : "Ready to send to the customer"}
          </h2>
          <p className="text-sm text-muted">
            {result.escalated
              ? result.escalation_reason
              : `The AI is ${pct(result.confidence)} sure, above your ${pct(threshold)} confidence level.`}
          </p>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <dl className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted">Condition</dt>
            <dd className="text-base font-semibold text-ink">{result.level_name}</dd>
            <dd className="text-xs text-muted">Level {result.condition_level}</dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted">Estimated price</dt>
            <dd className="text-[28px] font-semibold leading-tight tabular-nums text-ink">RM{result.price_estimate}</dd>
            {result.price_min != null && result.price_max != null && (
              <dd className="text-xs text-muted">Your range for this level: {priceText(result.price_min, result.price_max)}</dd>
            )}
          </div>
        </dl>

        {/* Confidence against the merchant's level */}
        <div className="space-y-2 border-t border-divider pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted">How sure the AI is</span>
            <span className="text-sm font-semibold tabular-nums text-ink">
              {confidenceLabel(result.confidence)} · {pct(result.confidence)}
            </span>
          </div>
          <div
            className="relative h-2 overflow-hidden rounded-full bg-brand-soft"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(result.confidence * 100)}
            aria-label="AI confidence"
          >
            <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out" style={{ width: pct(result.confidence) }} />
            <div className="absolute inset-y-0 w-0.5 bg-amber-600" style={{ left: pct(threshold) }} aria-hidden />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="inline-block h-2.5 w-0.5 bg-amber-600" aria-hidden />
            Your confidence level: {pct(threshold)}
          </p>
        </div>

        <div className="space-y-1.5 border-t border-divider pt-4">
          <h3 className="text-xs font-medium text-muted">Why the AI chose this</h3>
          <p className="text-sm leading-relaxed text-ink">{result.reasoning}</p>
        </div>

        {result.key_observations.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-medium text-muted">What the AI noticed</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink marker:text-muted">
              {result.key_observations.map((obs, i) => (
                <li key={i}>{obs}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="border-t border-divider pt-3 text-xs text-muted">
          Checked by {result.model_used} · Reference {result.assessment_id.slice(0, 8)}
        </p>
      </div>
    </section>
  );
}
