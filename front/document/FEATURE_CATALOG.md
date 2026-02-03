## 1️⃣ Core Journal Workflow

| Feature                 | What the user sees / does                                                      | Why it matters                                           |
| ----------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------- |
| **Dream Capture**       | Free‑text entry screen (optionally voice‑to‑text). “Save” button stores dream. | First step – the raw material for every later insight.   |
| **Save & Secure Vault** | Dreams are persisted in a personal library, indexed by date.                   | Guarantees that the user can always return to any entry. |
| **Edit / Delete**       | Swipe‑to‑edit, long‑press‑to‑delete with confirmation dialog.                  | Gives control and encourages regular journalling.        |

---

## 2️⃣ Automatic Jungian Analysis

| Feature                             | Description                                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **LLM‑driven Prose Interpretation** | After saving, the model returns a 150‑200 word Jungian reading (archetypes, shadow, anima/animus, etc.). |
| **Symbolic Tag Extraction**         | The same request also yields a comma‑separated list of symbols (e.g., “water, flight, darkness”).        |
| **One‑call Prompt**                 | A single prompt instructs the model to output **both** sections, simplifying the pipeline.               |
| **Result Presentation**             | Tag list shown as clickable chips; prose displayed in a scrollable paragraph beneath.                    |

---

## 3️⃣ Tag Management & Redundancy Detection

| Feature                     | Behavior                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Tag Cloud on Entry**      | Each dream shows its tags as a small “cloud” badge.                                                          |
| **Redundancy Highlight**    | When a newly‑saved tag already exists in the user’s history, it is highlighted (e.g., with a colour accent). |
| **Progression Scoring**     | The system calculates how often each tag appears over time, flagging rising or fading symbols.               |
| **Hierarchical Tag Option** | Tags can be flat or grouped (e.g., `element: water`, `action: flight`). This supports richer analysis later. |

---

## 4️⃣ User‑Data View (Historical Dashboard)

| Section                  | Key UI Elements                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------ |
| **Dream‑List Summary**   | Chronological list with date, title, and a small tag badge.                          |
| **Detail Screen**        | Full dream text, tag list, and the AI‑generated interpretation.                      |
| **Search & Filters**     | Text search, date‑range picker, and tag‑based filters.                               |
| **Bookmark / Favourite** | Star icon to mark “important” entries; a “Favourites” filter surfaces them quickly.  |
| **Export / Backup**      | One‑tap export of selected dreams (JSON or PDF).                                     |
| **Comparative View**     | Select two or more entries → side‑by‑side display with overlapping tags highlighted. |

---

## 5️⃣ Visualisation & Progress Tracking

| Feature                          | Description & UI pattern                                                                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Timeline (Horizontal Scroll)** | Dreams plotted along a timeline; colour‑code each point by dominant archetype or most frequent tag. This follows best‑practice timeline visualisations for mobile health apps [2]. |
| **Circular/Spiral Heatmap**      | Optional “spiral of the year” view where density of a tag creates a heat map, helping users spot cycles.                                                                           |
| **Tag Frequency Dashboard**      | Bar chart or bubble chart showing top 10 symbols, their counts, and growth rates.                                                                                                  |
| **Pattern Report Generator**     | On demand (or nightly) the system produces a short report summarising dominant symbols, emerging archetypes, and any notable shifts.                                               |
| **Push / In‑app Notifications**  | “Your symbol ‘water’ appeared 3 times this week – explore its meaning.” Keeps the experience proactive.                                                                            |

---

## 6️⃣ Settings & Preferences

| Feature                      | Purpose                                                                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| **Theme (Light/Dark)**       | Improves readability for night‑time journalling.                              |
| **Language**                 | UI localisation; the analysis model can be swapped for other languages later. |
| **Notification Preferences** | Opt‑in/out of pattern reports, new‑interpretation alerts, etc.                |
| **Data Management**          | Delete all dreams, clear tags, or request a data export.                      |

---

## 7️⃣ Administrative / Backend Helpers (for the development team)

| Feature                 | Why it’s needed                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------- |
| **Admin Dashboard**     | View usage metrics, model latency, error logs.                                        |
| **Model Versioning**    | Switch between LLM versions without redeploying the whole app.                        |
| **Tag Taxonomy Editor** | Edit/extend the hierarchical tag list without code changes.                           |
| **Analytics**           | Track which tags trigger the most user engagement (e.g., opening the interpretation). |

---

### How the pieces fit together

1. **Capture** → 2. **Run analysis** → 3. **Store dream + tags + prose** → 4. **Show in User‑Data View** → 5. **Visualise trends** → 6. **Deliver reports & notifications**.

Each step is independent but chained, so you can ship a minimal MVP (capture + analysis + list view) and then iteratively add the richer visualisations and reporting layers.
