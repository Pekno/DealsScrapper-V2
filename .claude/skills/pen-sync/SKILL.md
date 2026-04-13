---
name: pen-sync
description: "Sync design changes from a Pencil (.pen) wireframe back into React code. Use this skill whenever the user has modified a .pen wireframe and wants to implement those changes in the codebase, or says 'sync from pen', 'implement wireframe', 'update from pen', 'pen sync', 'apply design changes'. Compares the .pen design with current React code and generates a diff of changes to apply."
argument-hint: "[.pen file path or page name, e.g., 'login', 'pencil-new.pen']"
---

# Sync Pencil Wireframe Changes to React Code

Implement .pen design changes back into the React codebase. Argument: ``

## Step 1: Identify the .pen File and Target Page

### Find the .pen file:
- All pages live in `apps/web/mockup/app.pen` — always open this file
- If argument is a page name (e.g., `login`), it refers to a **screen frame** named `<Login> Page` inside `app.pen`, not a separate file
- Fallback: check currently open file via `get_editor_state` and locate the matching screen frame by name

### Find the corresponding React page:
- Map from .pen screen name to React page path
- If ambiguous, ask the user which React page corresponds to which .pen screen

## Step 2: Read Both Sides

### Read the .pen design:
1. `get_editor_state(include_schema: false)` — check current file
2. `batch_get(patterns: [{type: "frame"}], searchDepth: 1)` — list all screens
3. For the target screen, `batch_get(nodeIds: ["<screenId>"], readDepth: 4)` — deep read
4. `get_screenshot(nodeId: "<screenId>")` — capture the visual

### Read the React code:
1. Read the main page file
2. Read all imported visual components and their styles
3. Build the current component tree model

## Step 3: Compare and Diff

Analyze differences between the .pen design and current React code:

### Properties to compare:
| Aspect | .pen Property | React Equivalent |
|---|---|---|
| **Background** | `fill` | `bg-*` / `background` |
| **Text color** | text node `fill` | `text-*` / `color` |
| **Font size** | `fontSize` | `text-xs/sm/base/lg/xl` |
| **Font weight** | `fontWeight` | `font-normal/medium/semibold/bold` |
| **Spacing** | `gap`, `padding` | `gap-*`, `p-*`, `px-*`, `py-*` |
| **Border radius** | `cornerRadius` | `rounded-*` |
| **Border** | `stroke` | `border-*` |
| **Shadow** | `effect (shadow)` | `shadow-*` |
| **Layout direction** | `layout` | `flex-col` / `flex-row` |
| **Alignment** | `alignItems`, `justifyContent` | `items-*`, `justify-*` |
| **Sizing** | `width`, `height` | `w-*`, `h-*`, `max-w-*` |
| **New elements** | Nodes with no React match | New JSX elements |
| **Removed elements** | Missing nodes | JSX elements to remove |
| **Reordered elements** | Different node order | Reorder JSX children |
| **Text content** | `content` | String literals, labels |
| **Icons** | `iconFontName` | Lucide icon component name |

### Generate a change list:
For each difference found, create an entry:
```
- [CHANGE TYPE] Description
  .pen: <what the design shows>
  React: <what the code currently has>
  Action: <specific code change needed>
```

Change types: `LAYOUT`, `COLOR`, `TYPOGRAPHY`, `SPACING`, `ADD`, `REMOVE`, `REORDER`, `CONTENT`, `ICON`, `COMPONENT`

## Step 4: Present Changes to User

Show the user a summary of all detected changes:

```markdown
## Design Changes Detected

### Layout Changes
- ...

### Style Changes
- ...

### Content Changes
- ...

### New Elements
- ...

### Removed Elements
- ...
```

**Ask the user which changes to implement.** Options:
- "Apply all changes"
- "Apply only [specific categories]"
- "Let me pick individual changes"
- "Show me the code diff first"

## Step 5: Implement Approved Changes

For each approved change:

1. **Identify the exact file and line** to modify
2. **Apply the change** using Edit tool:
   - Tailwind class modifications
   - Vanilla Extract style updates
   - JSX structure changes
   - New component additions
3. **Preserve all existing logic** — NEVER modify:
   - Event handlers
   - State management
   - API calls
   - Auth logic
   - Data fetching
   - Conditional rendering logic (though you may change what's rendered)

### Tailwind Mapping Reference:

**Spacing (rem-based, 1 unit = 4px):**
| Pencil px | Tailwind |
|---|---|
| 4 | `1` |
| 8 | `2` |
| 12 | `3` |
| 16 | `4` |
| 20 | `5` |
| 24 | `6` |
| 32 | `8` |
| 40 | `10` |
| 48 | `12` |

**Font Size:**
| Pencil px | Tailwind |
|---|---|
| 12 | `text-xs` |
| 14 | `text-sm` |
| 16 | `text-base` |
| 18 | `text-lg` |
| 20 | `text-xl` |
| 24 | `text-2xl` |
| 30 | `text-3xl` |

**Border Radius:**
| Pencil px | Tailwind |
|---|---|
| 4 | `rounded` |
| 6 | `rounded-md` |
| 8 | `rounded-lg` |
| 12 | `rounded-xl` |
| 16 | `rounded-2xl` |
| 9999 | `rounded-full` |

## Step 6: Verify

1. Read the modified files to confirm changes look correct
2. If the `/validate-changes` skill is available, run it to ensure no breakage
3. Offer to re-export the page to .pen to verify visual match:
   - "Want me to re-export this page to .pen to verify the changes match?"

## Important Rules

- **After any .pen file modifications**, ALWAYS remind the user: "Please save the .pen file in Pencil (Ctrl+S) — I cannot save it automatically."
- **Creating new .pen files:** Always copy `apps/web/mockup/_default.pen` as a template instead of using `open_document("new")`. The `open_document` timeout error is a false alarm — the file opens successfully.
- **NEVER modify non-visual code** (hooks, state, API, auth, routing logic)
- **NEVER delete components** without explicit user approval
- **ALWAYS show the change plan** before implementing
- **ALWAYS preserve accessibility** attributes (aria-*, role, etc.)
- When unsure about a mapping, ask the user rather than guessing
- If the .pen design introduces a completely new section/component, create it as a new React component
