---
name: pen-export
description: "Export a React page or component from the web frontend into a Pencil (.pen) wireframe. Use this skill whenever the user wants to create a wireframe from existing code, export a page to .pen, visualize a React page as a design, or says 'export to pen', 'create wireframe', 'wireframe this page', 'pen export'. This reads the React source code, analyzes layout/components/styling, and generates an accurate .pen representation."
argument-hint: "[page path, e.g., 'login', 'filters', 'apps/web/src/app/dashboard/page.tsx']"
---

# Export React Page to Pencil Wireframe

Export a React page to a .pen wireframe. Argument: ``

## Step 1: Resolve the Page Path

If the argument is a short name (e.g., `login`, `filters`, `dashboard`):
- Map to `apps/web/src/app/<name>/page.tsx`
- If not found, search with `Glob` for `apps/web/src/app/**/<name>*/page.tsx`

If the argument is a full path, use it directly.

## Step 2: Deep-Read the React Page

Read the page file AND all its visual dependencies:

1. **Read the main page file** — understand the JSX structure
2. **Read all imported components** — trace every `import` that renders UI:
   - Local components (features/, shared/ui/, etc.)
   - Their style files (.css.ts, Tailwind classes)
3. **Read style files** — .css.ts (Vanilla Extract) and inline Tailwind classes
4. **Build a mental model:**
   - Full component tree (what renders what)
   - Layout structure (flex directions, gaps, padding)
   - Colors used (backgrounds, text, borders, accents)
   - Typography (font sizes, weights, families)
   - Icons used (Lucide icon names)
   - Interactive states (default state only for wireframe)
   - Responsive behavior (use desktop layout for wireframe)

## Step 3: Prepare the .pen File

**Convention: Single shared file.** ALL pages live in `apps/web/mockup/app.pen` as separate screen frames. NEVER create per-page `.pen` files.

1. Call `get_editor_state(include_schema: true)` — check current editor state
2. Target file is always `apps/web/mockup/app.pen`
3. If `app.pen` already exists, call `open_document("<absolute-path>/apps/web/mockup/app.pen")` to open it
4. If `app.pen` does **not** exist, create it from the template:
   ```bash
   cp apps/web/mockup/_default.pen apps/web/mockup/app.pen
   ```
   Then call `open_document("<absolute-path>/apps/web/mockup/app.pen")`. **Note:** The `open_document` call may report a timeout error — **ignore it**, the file opens successfully.
5. Call `get_guidelines("web-app")` — load design rules
6. **Determine placement using the canvas layout convention:**
   - The canvas uses a **column-based matrix**: each column = one page, col spacing = **2200px** (1440px frame + 760px notes zone), row 1 at y=200
   - The 760px notes zone = 200px left margin + 340px notes column + 220px right margin — every frame must leave room for review annotations
   - Use `batch_get` to list all top-level frames and find the highest column index (highest x value / 2200), then place the new frame at the next column: `x = (maxColIndex + 1) * 2200, y = 200`
   - Frame name must follow the convention: `Page Name — /route` (e.g., `Filters Page — /filters`)
   - If no frames exist yet, start at x=0, y=200

## Step 3b: Resolve Design System Components

**Load the `pen-design-system` skill** before building anything.

- Read `apps/web/mockup/design-system-index.json` → get node IDs for shared components (GlobalHeader, Sidebar, etc.)
- If the index is missing or incomplete, do a one-time `batch_get` scan and write the index
- You will use these IDs in Step 4b to copy components rather than rebuild them

## Step 4: Build the Wireframe

Create the wireframe section by section. Follow this order:

### 4a. Create the Screen Frame
```
screen=I(document, {type:"frame", name:"<PageName> Page", x:<x>, y:<y>, width:1440, height:"fit_content(900)", layout:..., placeholder:true, fill:<bg-color>})
```
- Use the actual background from the React page (gradient, solid color, etc.)
- Set `placeholder: true` — MANDATORY during construction

### 4b. Build Top-Down, Section by Section

**Always copy Design System components first, then build page-specific content.**

- **Navigation/Header** — use `C("<GlobalHeader-node-id>", screen, {...})` if it exists in the index; otherwise build it and add to Design System + index
- **Sidebar** — use `C("<Sidebar-node-id>", screen, {...})` if it exists
- **Main content area** — build page-specific content from scratch
- **Cards/Forms/Tables** — copy from Design System if available, else build new
- **Footer** (if present)

### 4c. Component Translation Rules

**DealsScrapper Color Palette:**
```
Primary Blue:     #0F62FE
Primary Hover:    #0D5CE8
Danger Red:       #EF4444
Success Green:    #10B981
Background:       #F9FAFB
Card Surface:     #FFFFFF
Text Primary:     #1F2937
Text Secondary:   #6B7280
Text Tertiary:    #9CA3AF
Border:           #D1D5DB
```

**Layout Mapping:**
| React/Tailwind | Pencil |
|---|---|
| `flex flex-col` | `layout: "vertical"` |
| `flex flex-row` | `layout: "horizontal"` |
| `gap-4` (16px) | `gap: 16` |
| `p-4` (16px) | `padding: 16` |
| `px-6 py-4` | `padding: [16, 24]` |
| `items-center` | `alignItems: "center"` |
| `justify-between` | `justifyContent: "space_between"` |
| `w-full` | `width: "fill_container"` |
| `rounded-xl` | `cornerRadius: 12` |
| `rounded-2xl` | `cornerRadius: 16` |
| `rounded-full` | `cornerRadius: 9999` |
| `shadow-xl` | `effect: {type:"shadow", shadowType:"outer", offset:{x:0,y:4}, blur:24, color:"#0000001A"}` |

**Typography Mapping:**
| React/Tailwind | Pencil |
|---|---|
| `text-xs` | `fontSize: 12` |
| `text-sm` | `fontSize: 14` |
| `text-base` | `fontSize: 16` |
| `text-lg` | `fontSize: 18` |
| `text-xl` | `fontSize: 20` |
| `text-2xl` | `fontSize: 24` |
| `font-medium` | `fontWeight: "500"` |
| `font-semibold` | `fontWeight: "600"` |
| `font-bold` | `fontWeight: "700"` |

**Icon Mapping:**
- Use `icon_font` with `iconFontFamily: "lucide"` and the Lucide icon name
- Always set `width`, `height`, and `fill` on icons

**Input Fields:**
- Frame with `stroke: {align:"inside", thickness:1, fill:"#D1D5DB"}`
- Icon (if present) + placeholder text inside
- Height: 44-48px, cornerRadius: 10-12

**Buttons:**
- Primary: `fill: "#0F62FE"`, white text, `cornerRadius: 9999`
- Secondary: `fill: "#F3F4F6"`, dark text
- Danger: `fill: "#EF4444"`, white text

### 4d. Batch Size
- Keep each `batch_design` call to **maximum 25 operations**
- Split by logical sections: header, then form, then footer, etc.

## Step 5: Finalize

1. Remove the placeholder flag: `U("<screenId>", {placeholder: false})`
2. Take a screenshot: `get_screenshot(nodeId: "<screenId>")`
3. Verify the screenshot matches the React page's visual layout
4. If issues are found, fix them with additional `batch_design` calls
5. Report the result to the user with a summary of what was created

## Step 6: Remind to Save

**IMPORTANT:** After completing all design work, ALWAYS tell the user:

> "Please save the .pen file in Pencil (Ctrl+S) — I cannot save it automatically."

## Step 7: Offer Next Steps

After export, suggest:
- "Want me to review the wireframe for UX/UI improvements?"
- "Want me to create a mobile version of this page?"
- "You can edit the .pen file in Pencil, then use `/pen-sync` to bring changes back to code."
