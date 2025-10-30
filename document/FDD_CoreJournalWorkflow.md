# Functional Design Document (FDD) – Core Journal Workflow  

*Dream Analyst* – SvelteKit application  

---

## 1️⃣ Overview  

The **Core Journal Workflow** lets a user create a new dream entry, optionally using voice‑to‑text, and instantly stores the raw dream, the generated symbolic tags, and the AI‑written Jungian interpretation. This is the foundational feature on which all later dashboards, reports, and visualisations depend.

---

## 2️⃣ Scope  

| In‑Scope | Out‑of‑Scope |
|----------|---------------|
| • Text‑based dream entry screen.  <br>• Voice‑to‑text capture using the Web Speech API (via **svelte‑speech‑recognition** library) [1]. <br>• Immediate persistence to PostgreSQL. <br>• Return of generated tags + prose interpretation (LLM call via n8n). <br>• Basic UI feedback (saving spinner, success toast). | • Advanced editing (history‑versioning). <br>• Multi‑language voice support. <br>• Offline voice capture. <br>• Custom AI model training (outside the LLM call). |

---

## 3️⃣ Stakeholders  

| Role | Interest / Responsibility |
|------|---------------------------|
| Product Owner | Defines dream‑capture requirements, approves UI/UX. |
| Front‑end Engineer | Implements SvelteKit screens, integrates voice library, handles UI state. |
| Back‑end Engineer | Builds API endpoint, stores data, triggers n8n workflow. |
| AI / Data Engineer | Provides prompt template, ensures LLM returns both tags and prose. |
| QA Engineer | Verifies voice capture, data persistence, error handling. |
| End‑User (Dreamer) | Records dreams quickly, sees immediate analysis. |

---

## 4️⃣ Functional Requirements  

| ID | Description | Priority |
|----|-------------|----------|
| FR‑1 | **Text capture** – The system shall present a multiline textarea where the user can type a dream. | High |
| FR‑2 | **Voice capture** – The system shall allow the user to press a “mic” button, record speech, and convert it to text using the browser’s Web Speech API. The resulting transcript shall populate the textarea. | High |
| FR‑3 | **Save button** – The system shall enable a “Save” action only when the textarea contains ≥ 10 characters. | High |
| FR‑4 | **Persist dream** – Upon Save, the backend shall store: `user_id`, `timestamp`, `raw_text`, and a status flag (`PENDING_ANALYSIS`). | High |
| FR‑5 | **Trigger analysis** – After persisting, the backend shall invoke an n8n workflow that sends `raw_text` to the selected LLM and receives: <br>• A comma‑separated list of symbolic tags. <br>• A 150‑200 word Jungian prose interpretation. | High |
| FR‑6 | **Store results** – The backend shall update the record with `tags` (JSON array) and `interpretation` (text), and set status to `completed`. | High |
| FR‑7 | **UI feedback** – While the analysis is running, show a loading spinner and a “Analyzing…” toast. When finished, display the tags (as chips) and the prose below the textarea. | Medium |
| FR‑8 | **Error handling** – If the LLM call fails, the system shall set status to `ANALYSIS_FAILED` and display a retry button. | Medium |
| FR‑9 | **Accessibility** – All controls must be operable via keyboard and have ARIA labels. | Medium |

---

## 5️⃣ Non‑functional Requirements  

| ID | Requirement |
|----|-------------|
| NFR‑1 | **Performance** – Dream save request must respond within 300 ms; analysis latency (including n8n + LLM) should be ≤ 5 s on average. |
| NFR‑2 | **Scalability** – Backend API must handle ≥ 100 concurrent save requests without degradation (via connection pooling and async calls). |
| NFR‑3 | **Browser Compatibility** – Voice capture must work on Chrome desktop (full support) and gracefully degrade on browsers without the Web Speech API (show “type only” notice). |
| NFR‑4 | **Security** – All API traffic encrypted via HTTPS; JWT‑based authentication for the save endpoint. |
| NFR‑5 | **Reliability** – Persisted dreams must survive a backend crash; use PostgreSQL transaction for save + analysis‑trigger. |
| NFR‑6 | **Maintainability** – Front‑end component (`DreamEntry.svelte`) and back‑end controller (`dream.controller.ts`) should each be ≤ 200 lines, well‑commented, and covered by unit tests. |

---

## 6️⃣ Use‑Cases / User Stories  

| # | As a… | I want to… | Acceptance Criteria |
|---|-------|------------|---------------------|
| UC‑1 | Dreamer | type my dream and hit **Save**. | The dream appears in my personal list with a “pending analysis” badge; after ≤ 5 s I see tags and prose. |
| UC‑2 | Dreamer | speak my dream instead of typing. | Pressing the mic button starts recording, transcription appears in the textarea, and I can edit before saving. |
| UC‑3 | Dreamer | know when something goes wrong. | If the AI call fails, a red toast shows “Analysis failed – retry?” and a **Retry** button re‑invokes the workflow. |
| UC‑4 | Developer | quickly see the data model. | The `dreams` table contains columns `id`, `user_id`, `created_at`, `raw_text`, `tags` (JSON), `interpretation`, `status`. |

---

## 7️⃣ Data Model (Overview)  

**Table: dreams**  

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique identifier. |
| user_id | UUID (FK) | Owner of the dream. |
| created_at | TIMESTAMP | When the entry was saved. |
| raw_text | TEXT | Original user‑provided dream (typed or transcribed). |
| tags | JSONB | Array of strings (e.g., `["water","flight"]`). |
| interpretation | TEXT | AI‑generated Jungian prose. |
| status | ENUM('PENDING_ANALYSIS','completed','ANALYSIS_FAILED') | Processing state. |

*All columns are **NOT NULL** except `tags` and `interpretation` until analysis finishes.*

---

## 8️⃣ UI/UX Sketches (text description)  

1. **Dream Entry Screen**  
   * Header: “New Dream”.  
   * Textarea occupies most vertical space.  
   * Mic button (microphone icon) on the right of the textarea – toggles between **recording** (red pulse) and **idle**.  
   * “Save” button disabled until ≥ 10 characters.  
   * Below the button: *“Your dream will be analyzed instantly – please wait a few seconds.”* (hidden after save).  

2. **Post‑Save View**  
   * Success toast: “Dream saved! Analyzing…”.  
   * Loading spinner replaces the Save button.  
   * When analysis returns:  
     * Tag chips appear in a horizontal scrollable row (each chip shows a tag, can be tapped to filter later).  
     * Prose interpretation appears in a bordered container with a “Copy” icon.  

---

## 9️⃣ Integration & APIs  

| Component | Responsibility | Endpoint / Call |
|-----------|----------------|-----------------|
| Front‑end (`DreamEntry.svelte`) | Collect text, start/stop voice, POST to backend | `POST /api/dreams` (JSON `{ raw_text }`) |
| Backend (`dream.controller.ts`) | Validate, store, trigger n8n | Calls PostgreSQL, then `POST https://n8n.example.com/webhook/dream-analysis` |
| n8n workflow | Receive `raw_text`, call LLM (OpenAI / Gemini), parse response | LLM Prompt → returns `tags` & `interpretation` → POST back to `/api/dreams/:id/result` |
| Result endpoint | Save tags & prose, update status | `POST /api/dreams/:id/result` (JSON `{ tags, interpretation }`) |

*All API calls require Bearer JWT token for `user_id` extraction.*

---

## 🔟 Acceptance Criteria  

1. **Happy Path** – User records a dream (typed or spoken) → sees tags + interpretation within ≤ 5 s.  
2. **Voice Fallback** – In browsers without Web Speech API, the mic button is hidden and a tooltip explains “typing only”.  
3. **Error Path** – If n8n or LLM returns error, UI shows retry option and status is set to `ANALYSIS_FAILED`.  
4. **Data Integrity** – After a successful save, the `dreams` row contains non‑null `raw_text`, `tags`, `interpretation`, and `status='completed'`.  
5. **Security** – Unauthenticated request to `/api/dreams` returns 401; authenticated request stores `user_id` correctly.  

---

## 11️⃣ Open Issues & Assumptions  

* **Assumption 1:** Users will have a microphone and a browser that supports the Web Speech API (Chrome desktop). Other browsers will fall back to text only.  
* **Assumption 2:** The n8n workflow will return tags in a comma‑separated string and a prose block within the same HTTP response. If the workflow changes, endpoint contracts must be updated.  
* **Assumption 3:** The LLM prompt is stable and yields both tags and interpretation consistently; prompt tuning may be required later.  
* **Open Issue 1:** Exact LLM provider (OpenAI vs. Gemini) and pricing model not yet fixed – the API call code should be abstracted to a “LLM client” interface.  
* **Open Issue 2:** Voice‑to‑text accuracy varies; we may need a “review transcript” step before saving.  

---

### Next Steps  

1. Front‑end developer creates `DreamEntry.svelte` using the **svelte‑speech‑recognition** library [1].  
2. Back‑end engineer scaffolds the `/api/dreams` POST endpoint and the result endpoint.  
3. Data engineer drafts the n8n workflow (receive text → LLM → return tags + interpretation).  
4. QA writes test cases for happy path, voice fallback, and error handling.  
