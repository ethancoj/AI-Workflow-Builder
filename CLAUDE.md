# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Final-year project (FYP): an AI workflow builder for Malaysian small-business merchants. The repo has two apps that run separately, with no root workspace tooling:

- `apps/web` — Next.js 16 (App Router, React 19, Tailwind v4, TypeScript) frontend
- `apps/api` — FastAPI backend (Python 3.13, `venv/` lives in `apps/api`)

Both apps talk to the same Supabase project.

For requirements, objectives, the FYP2 roadmap and the gaps between the report and this code, read `docs/plan-summary.md`.

## Commands

Frontend (run from `apps/web`):
```
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint     # ESLint 9 flat config (eslint.config.mjs)
```

Backend (run from `apps/api`; imports such as `from routers import quotes` assume this is the working directory):
```
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload        # http://localhost:8000, docs at /docs
```

`requirements.txt` is UTF-16 encoded (it came from `pip freeze` in PowerShell). If you regenerate it, write UTF-8 instead: `pip freeze | Out-File -Encoding utf8 requirements.txt`.

Neither app has a test suite.

## Environment variables

These files are gitignored and must never be committed:

- `apps/api/.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (used in `main.py`), `SUPABASE_SERVICE_KEY` (used by the quotes router), `GEMINI_API_KEY`, and optionally `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` for model benchmarking
- `apps/web/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (the FastAPI base URL)

CORS in `apps/api/main.py` only allows `localhost:3000` and `127.0.0.1:3000`.

## Architecture

### Module 1: Workflow builder (`/builder`)
- `src/app/builder/page.tsx` wraps `Sidebar` and `Canvas` in a `ReactFlowProvider`.
- `src/app/builder/page.tsx` also renders `SettingsPanel`, the right-hand form for whichever single node is selected.
- `src/lib/workflow/types.ts` defines each node type's `data` and the saved `WorkflowJson` (`{version: 1, nodes, edges}`). The future FastAPI translation layer reads this JSON, so treat these field names as a contract.
- Branching is encoded in edge `sourceHandle`:
  - Each Condition branch's `id` is its handle id, with `else` as the fallback handle.
  - Quote nodes have `quoted` and `escalated` handles.
  - `onConnect` in the store keeps exactly one edge per source handle.
- State lives in a Zustand store (`src/lib/workflow/builderStore.ts`). The initial Start node uses a fixed id (`start-1`) to avoid hydration mismatches, and the store allows only one Start node.
- Node display info (label, icon, colour) lives only in `src/lib/workflow/nodeMeta.ts`. To add a node type, change these four places:
  - the types in `types.ts`
  - `NODE_META`, `NODE_ORDER` and `createNode` in `nodeMeta.ts`
  - a view in `components/builder/nodes.tsx`
  - a form in `SettingsPanel.tsx`
- The Quote node's rubric picker loads from `GET /api/quotes/rubrics/{merchant_id}`. Rubrics are created with the Quotes page's "Save rubric" button. Both use `PLACEHOLDER_MERCHANT_ID` from `src/lib/merchant.ts` until auth exists.
- "Save workflow" inserts a new row into the Supabase `workflows` table (`flow_json`) directly from the browser using the anon key. Nothing loads or executes saved workflows yet.
- Use `@xyflow/react` (React Flow v12). The legacy `reactflow` v11 package is also in `package.json` but is not imported.

### Module 2: Vision quoting engine (`/quotes`)
- Frontend: `src/components/quotes/QuoteDemo.tsx` lets the merchant edit a pricing rubric (condition levels, prices, visual cues, escalation threshold), then POSTs multipart form data (`image`, `rubric_json`, `model`) to `${NEXT_PUBLIC_API_URL}/api/quotes/assess`.
- Backend: `apps/api/routers/quotes.py` (prefix `/api/quotes`).
  - The design is model-agnostic so that FYP Objective 2 (benchmarking VLM accuracy) is fair. Every backend gets the identical prompt from `_build_prompt(rubric)`, and its output goes through the shared `_parse_json`. To add a model, write a new `_call_<model>` function, add it to `ModelChoice`, `MODEL_LABELS` and the dispatch in `assess_photo`, and do not fork the prompt.
  - Current backends: Gemini (`google.genai` client, `gemini-2.0-flash`, the default), OpenAI `gpt-4o-mini` and Anthropic `claude-haiku-4-5`. The `MODEL_LABELS` display strings do not exactly match the model IDs.
  - Pipeline: validate the rubric, then the image (jpeg/png/webp, 10 MB max), call the VLM, check the returned `condition_level` against the rubric, and escalate when `confidence < rubric.escalation_threshold`. If `merchant_id` is given, it also persists the image to the Supabase storage bucket `quote-images` and the row to the `quote_assessments` table. Persistence failures are only logged.
  - Rubric CRUD uses the `rubrics` table, and the backend uses the Supabase service key.
- The file imports both `google.generativeai as genai` and `from google import genai`. The second import shadows the first, so `genai` refers to the new `google-genai` SDK.

### Other
- `src/app/page.tsx` and `layout.tsx` are still the create-next-app boilerplate.
- `apps/web/README.md` is the default Next.js README.
- Next.js 16 may differ from older versions you know. Bundled docs are in `apps/web/node_modules/next/dist/docs/`.
