# FYP Plan Summary

A condensed version of `docs/FYP1_Report_Ethan.pdf` (FYP1, Sem 1 2025/26, University of Malaya). Read this instead of the full report. Only go back to the PDF for the literature review or exact wording.

## Project

**Merchant Visual Workflow Builder for WhatsApp-Native Service Commerce**
- Students: Ethan Ico Jokinol and Wang Ruoxu
- Supervisor: Assoc. Prof. Ts. Dr. Aznul Qalid Bin Md Sabri
- Industry partner: Fylix

Non-technical Malaysian SME service merchants (aircon servicing, salons, home repair; Klang Valley) design WhatsApp chatbot workflows by dragging and dropping nodes. They never write prompts: all AI behaviour comes from structured form inputs on each node.

**Gaps it addresses:**
1. The technical barrier of existing tools (Botpress, Flowise, n8n, OpenAI Agent Builder)
2. No Manglish (code-switched Malay/English) understanding
3. No vision-based quoting

**Research questions:**
- **RQ1:** Can a node-based builder make AI prompt configuration accessible to non-technical merchants?
- **RQ2:** Can a vision-language model (VLM) give commercially defensible prices from merchant-defined visual rubrics, and what confidence gating best handles uncertain cases?
- **RQ3:** How reliably can a visual workflow be translated into executable AI logic on live WhatsApp?

## Objectives and ownership

| Obj | Module | Owner |
|---|---|---|
| 1 | Visual workflow builder (React Flow) | Ethan |
| 2 | Manglish NLU, benchmarked against fine-tuned BERT and few-shot GPT-4o Mini | Wang Ruoxu |
| 3 | Vision quoting engine with confidence gating | Ethan |
| 4 | Natural-language scheduling: Malay/English time expressions, calendar API, soft-lock against double-booking | Wang Ruoxu |
| 5 | **Translation layer**: workflow JSON → runtime AI prompt logic. The core engineering contribution, linking the builder to the three AI modules. | Integration |

This repo holds Ethan's modules (1 and 3). Modules 2 and 4 are not here.

## Planned architecture / stack

- **Frontend:** Next.js (App Router, TypeScript, Tailwind), React Flow (`@xyflow/react`), Zustand for builder state
- **Backend:** FastAPI. It serves the API, receives the WhatsApp webhook, and runs the VLM pipeline and the workflow runtime engine.
- **Data:** Supabase Postgres (merchant configs, workflows, rubrics, quote assessments) and Supabase Storage (`quote-images` bucket, private with RLS)
- **VLMs:** GPT-4o Mini (primary), Gemini and Claude, selectable in the UI and all using the same `_build_prompt()` so benchmarking is fair
- **Messaging:** Twilio WhatsApp sandbox (FYP2)

Runtime flow (FYP2 target):
1. A customer sends a WhatsApp message to Twilio, which calls the FastAPI webhook.
2. FastAPI loads the merchant's workflow JSON from Supabase.
3. The translation layer walks the nodes and calls NLU, quoting or scheduling as each node requires.
4. The reply goes back through Twilio.

### Node types
- **Start:** triggered by an incoming WhatsApp message
- **LLM Response:** replies using a merchant-defined persona and instructions
- **Condition:** branches on detected intent or extracted entities
- **Quote:** takes a photo and applies the merchant's rubric
- **End:** sends the final reply
- **API Call:** specified, but reserved for FYP2

## Requirements

### Functional

| ID | Requirement | Report status |
|---|---|---|
| FR1.1 | Drag-and-drop canvas with 5 configurable node types | Achieved |
| FR1.2 | Serialise the node graph to workflow JSON on save | Achieved |
| FR1.3 | Deploy a workflow to live WhatsApp in 3 clicks | FYP2 |
| FR1.4 | Inject merchant config into AI prompts at runtime | Achieved (PoC) |
| FR1.5 | Pre-built workflow templates | FYP2 |
| FR2.1 | Accept a customer photo via WhatsApp image message | Achieved (API only) |
| FR2.2 | Merchant defines 3 visual rubric tiers with price ranges | Achieved |
| FR2.3 | Return a price estimate and confidence score per photo | Achieved |
| FR2.4 | Route below-threshold assessments to a human agent | Achieved |
| FR2.5 | Image quality check before assessment | FYP2 |

### Non-functional

| ID | Requirement | Report status |
|---|---|---|
| NFR1 | Quote returned in 10 s or less | Met |
| NFR2 | Builder renders in 3 s or less | Met |
| NFR3 | API keys only in env vars, never client-side | Met |
| NFR4 | Photos in private Supabase bucket with RLS | Met |
| NFR5 | Usable by non-technical merchants, SUS ≥ 70 | FYP2 |
| NFR6 | 50 concurrent merchants | FYP2 |

## Vision quoting design

- **Zero-shot rubric injection:** the merchant's rubric text acts as the classifier, so there is no training and no CNN. This is justified by CLIP, BLIP, Brown et al. (2020) on in-context learning, and NVIDIA's VLM prompting guide.
- **Rubric:**
  - L1 Clean/Light, L2 Moderate, L3 Severe
  - Each level has a description, price and visual cues
  - The merchant can edit all of it
- **Output:** JSON with the condition level, price estimate, a confidence score from 0 to 1, reasoning and observations.
- **Confidence gating:** a configurable threshold, **initialised at 0.75** and tuned empirically. Below it, the case is escalated to a human instead of being quoted.
- **Preliminary finding:** L3 units with heavy dust but no mould were misclassified as L2, because the L3 cues focused on mould. The report uses this as evidence that rubrics must be editable by merchants. For FYP2, refine the L3 cues with Fylix merchants.

## Evaluation plan (FYP2)

- **Vision dataset:**
  - 50–100 self-collected aircon photos, about 15–30 per level, balanced
  - Augmented for brightness, contrast and angle to mimic WhatsApp photo quality
  - All photos are used as the test set (no training split)
- **Metrics:**
  - Vision quoting accuracy and MAPE
  - Formal multi-model comparison
  - NLU accuracy (Wang)
  - Scheduling success rate (Wang)
  - SUS usability study with merchants
- **Panel feedback to act on:**
  - Look for Kaggle or HVAC datasets to supplement the photo set
  - Try more models
  - Validate the requirements with Fylix early in FYP2

## FYP2 phases

1. **Module refinement:** NLU and vision engines toward production reliability; build the scheduling engine standalone.
2. **Full integration:** translation layer from React Flow JSON to the FastAPI runtime, the Twilio webhook, and wiring in all three AI modules.
3. **Summative evaluation and polish:** end-to-end validation, metrics, and the SUS study.

## Scope and limitations

- **WhatsApp:** Twilio sandbox only, with its message limits. The WhatsApp Business API needs business verification.
- **Vision:** aircon only, for the FYP.
- **Out of scope:** payments and voice messages.
- **Cost:** per-call VLM costs cap the dataset size.

## FYP2 progress and to-do (as of 2026-11-16)

### Done
- Settings form for every node type, with the config saved in the workflow JSON (`{version: 1, nodes, edges}`). Condition branches and the Quote node's quoted/escalated exits are separate edge handles.
- Builder state in Zustand (`src/lib/workflow/builderStore.ts`)
- Rubrics can be saved from `/quotes` and picked in a Quote node
- Workflow bar: name, open saved workflows, save/update in place, save as copy, unsaved-change warnings, `?id=` in the URL
- Supabase schema for the quote engine in `supabase/migrations/`: `rubrics`, `quote_assessments` (backend-only via RLS), and the private `quote-images` bucket. Photos are stored by path.

### Alignment tasks (small)
- Set the escalation threshold default to 0.75 in the backend `Rubric` and frontend `DEFAULT_RUBRIC`.
- Make GPT-4o Mini the default model, and align the `MODEL_LABELS` display names with the model IDs actually called. Check for deprecated model IDs.
- Support price *ranges* per rubric level (FR2.2).
- Agree the Condition node's intent names (currently placeholders like `booking`, `quote_request`) with Wang Ruoxu's NLU module.
- Add RLS policies for `workflows`. It's written from the browser with the anon key, so policies should restrict rows to the logged-in merchant once auth exists.

### To build
- Merchant auth and accounts, replacing `PLACEHOLDER_MERCHANT_ID`
- The translation layer and workflow runtime engine (Obj 5), the core contribution
- The Twilio WhatsApp webhook and send/receive (FR1.3, FR2.1 via WhatsApp)
- A human escalation queue or UI
- Deploy flow (FR1.3), templates (FR1.5), image quality check (FR2.5), and the API Call node
- An evaluation harness: dataset, augmentation, batch benchmark runner, accuracy and MAPE
- Integration with NLU and scheduling (Wang Ruoxu's modules)

### Suggested order
1. Merchant auth (Supabase Auth) with RLS on all merchant tables
2. The translation layer and runtime engine, tested with a mock message endpoint first
3. The Twilio sandbox webhook, with photos routed to `/api/quotes/assess`
4. The evaluation harness (independent, so it can run in parallel)
5. The alignment tasks above
