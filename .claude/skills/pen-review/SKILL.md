---
name: pen-review
description: "UX/UI review skill for Pencil (.pen) wireframes. Analyzes a page frame for design quality and leaves sticky post-it note annotations directly on the canvas — visible in Pencil — with findings, tips, and praise. Use this skill proactively whenever the user asks to 'review a page', 'give UX feedback', 'annotate the wireframe', 'leave notes on the design', 'what do you think of this screen', or says 'pen-review'. Also use it after exporting a new page to .pen to automatically leave an initial quality pass. Each note is color-coded by severity and placed to the right of the reviewed frame."
argument-hint: "[page name or frame name, e.g., 'login', 'filters', 'Admin Dashboard']"
---

# Pen Review — UX/UI Annotation Skill

Leave sticky post-it note annotations on a .pen wireframe after a UX/UI review. Argument: ``

---

## Step 1: Identify the Target Frame

- Open `apps/web/mockup/app.pen` via `get_editor_state`
- If the argument is a page name (e.g., `login`), match it to a frame named like `Login Page — /login`
- If ambiguous, list available frames and ask the user which one to review
- Use `batch_get(nodeIds: ["<frameId>"], readDepth: 4)` to deeply read the frame's structure
- Note the frame's **x**, **y**, **width**, and **height** — you'll need these to position notes

## Step 2: Visual Analysis

- Call `get_screenshot(nodeId: "<frameId>")` to capture the screen visually
- Study both the node tree (structure) and the screenshot (visual result)

## Step 3: Evaluate Against UX/UI Principles

Assess the frame across these dimensions. For each, form a verdict: ✅ good, 🟡 improvable, or 🔴 critical issue.

| Dimension | What to check |
|---|---|
| **Visual Hierarchy** | Is there one dominant region? Do important elements have more visual weight? |
| **Action Hierarchy** | Is there one clear primary action? Are secondary actions subordinate? Are destructive actions distinct? |
| **Spacing & Density** | Is spacing consistent? Does density match the complexity of the content? |
| **Typography** | Is there a clear type scale? Are labels readable? Is text contrast sufficient? |
| **Color Usage** | Are colors purposeful (not decorative)? Is the palette consistent? |
| **Contrast & Accessibility** | Do text/background combinations meet minimum contrast? Are touch targets large enough? |
| **Empty / Loading States** | Are states represented or implied in the design? |
| **Alignment** | Are elements aligned to an implicit grid? Do things feel anchored? |
| **Clarity** | Can a new user understand what this screen is for in 3 seconds? |

Aim for **3–7 findings** total — a mix of praise, suggestions, and critical issues. Don't manufacture findings; if something looks solid, say so.

## Step 4: Place Note Nodes on the Canvas

For each finding, insert a `note` node at the **document level** (parent = `document`), positioned to the **right** of the reviewed frame.

### Positioning formula
```
note_x = frame_x + frame_width + 200
note_y = frame_y + (note_index * (note_height + 20))
note_width = 340
note_height = fit to content (use ~180 as estimate)
```

All notes go in a **single column** to the right of the frame — no second column. Use a 200px horizontal margin so the notes don't feel cramped next to the frame. Stack notes vertically with a 20px gap.

The canvas uses a **2200px column grid** (1440px frame + 760px notes zone per column). Every frame is already spaced to accommodate a notes column — the 200px left margin lands squarely inside that reserved zone.

### Note color by severity
| Severity | Fill color | Prefix |
|---|---|---|
| 🔴 Critical | `#FFEBEE` | `🔴 Critical` |
| 🟡 Suggestion | `#FFF9C4` | `🟡 Tip` |
| 🟢 Good | `#E8F5E9` | `🟢 Good` |

### Note content format
```
🟡 Tip — Action Hierarchy
The "Save" and "Cancel" buttons have equal visual weight. Make "Save" primary (filled blue) and "Cancel" ghost/text-only to guide the user toward the intended action.
```

First line = severity prefix + em dash + short title (bold intent)  
Second+ lines = explanation (concise, actionable, max 2–3 sentences)

### Naming convention

Each note **must** be named `note-{frameId}-{i}` (e.g. `note-eML3U-0`, `note-eML3U-1`…). This links notes to their parent frame so they can be fetched or deleted by frame ID later.

To fetch all notes for a frame: `batch_get` with `patterns: [{type: "note", name: "note-{frameId}-.*"}]`.

### batch_design operation
```javascript
note0=I(document, {
  type: "note",
  name: "note-<frameId>-0",
  x: <note_x>,
  y: <note_y>,
  width: 340,
  content: "🟡 Tip — Action Hierarchy\nThe Save and Cancel buttons have equal visual weight...",
  fontSize: 13
})
```

**Do not set `fill` on note nodes** — the `note` type does not support it and the operation will fail. Notes have built-in post-it styling.

Insert all notes in a single `batch_design` call (max 25 ops). You do not need `placeholder` on notes — they are not frames.

## Generating an Improved Version

If the user asks to generate an improved version based on review notes:

1. **Copy** the original frame: `newFrame=C("<frameId>", document, {name: "<Original Name> (Improved)"})`
2. **Read** the copy's node tree (`batch_get`) to get new child IDs
3. **Apply** all improvements via `U()`, `I()`, `M()`, `R()` operations
4. **Place** the improved frame in the correct canvas position — **CRITICAL:**

### Canvas Placement Rules (MUST FOLLOW)

The canvas uses a **column × row matrix**:

| | Description | y position |
|---|---|---|
| **Row 1** | Implemented/production page | `y = 200` |
| **Row 2+** | Variants, WIP, improved versions | `y ≈ 2699` (row 1 height + 400px gap) |

**WIP/improved frames MUST go in Row 2, same column as the original:**
```
improved_x = original_frame_x        ← same column
improved_y = 2699                     ← Row 2 (or read existing Row 2 frames to align)
```

**NEVER place a variant/WIP frame in Row 1 alongside production frames** — it will overlap adjacent page columns (each column is only 2200px wide).

To find the correct y for Row 2, read existing top-level nodes and look for frames whose name contains "WIP", "Improved", or "Variant" — match their y value. If none exist, use `y = 2699`.

## Step 5: Verify and Wrap Up

- Call `get_screenshot` on the full canvas area around the frame to confirm notes are placed correctly and readable
- If notes are misaligned or overlapping, adjust y positions with `U()` calls
- Summarize findings to the user in the chat (1–2 lines per finding)
- **Always remind the user:** "Please save the .pen file in Pencil (Ctrl+S) — I cannot save it automatically."

---

## Cleanup

If the user asks to clear review notes for a frame:
- Use `batch_get` with `patterns: [{type: "note", name: "note-{frameId}-.*"}]` to find all notes linked to that frame
- Delete them with `D()` operations
