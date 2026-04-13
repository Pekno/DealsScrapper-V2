---
name: pen-design-system
description: "Load and resolve Design System component node IDs from the index file (apps/web/mockup/design-system-index.json). Use this skill at the start of any pen-export or pen-sync task that needs to reuse shared components (GlobalHeader, Sidebar, etc.) from the Design System frame in app.pen. Returns ready-to-use node IDs without scanning the .pen file."
argument-hint: "[optional: component name to look up, e.g., 'GlobalHeader']"
---

# Design System Index — Load & Resolve Component IDs

This skill manages `apps/web/mockup/design-system-index.json`, the persistent map of Design System component names to their stable Pencil node IDs. **Always use this instead of scanning `app.pen` with `batch_get`.**

## Index File Format

```json
{
  "_frame": "node-id-of-the-Design-System-root-frame",
  "_comment_*": "Keys starting with _comment_ are documentation — ignore them at runtime.",
  "GlobalHeader": "node-id-abc123",
  "SiteBadge": "node-id-base",
  "SiteBadgeDealabs": "node-id-variant"
}
```

- `_frame` — the root "Design System" frame node ID (used as parent when adding new components)
- `_comment_*` keys — inline documentation strings, **not node IDs** — skip them
- All other keys — individual component names mapped to their node IDs

---

## Component Patterns

### Standard components
Most components are standalone reusable frames. Use their node ID directly:
```javascript
C("node-id-abc123", targetFrame, { x: 0, y: 0 })
```

### Base + Variant pattern
Some components follow a **base + variant** pattern:

| Role | Name | How it works |
|------|------|-------------|
| Base | `SiteBadge` | Neutral shape/size, no site-specific colors. **Do not use directly on screens.** |
| Variant | `SiteBadgeDealabs` | Reusable ref extending `SiteBadge` with Dealabs colors baked in |
| Variant | `SiteBadgeVinted` | Reusable ref extending `SiteBadge` with Vinted colors baked in |
| Variant | `SiteBadgeLBC` | Reusable ref extending `SiteBadge` with LeBonCoin colors baked in |
| Base | `RoleBadge` | Neutral shape/size, no role-specific colors. **Do not use directly on screens.** |
| Variant | `RoleBadgeAdmin` | Reusable ref extending `RoleBadge` with Admin colors baked in |
| Variant | `RoleBadgeUser` | Reusable ref extending `RoleBadge` with User colors baked in |

**Key property:** shape changes to a base component (e.g. making `SiteBadge` square) automatically propagate to all its variants, since variants are reusable refs pointing to the base. Color/text overrides in variants are additive and unaffected.

**On screens, always use variants, never bases:**
```javascript
// ✅ Correct — use the site-specific variant
badge=I(cell, {type:"ref", ref:"FLunV"})  // SiteBadgeDealabs

// ❌ Wrong — base has no site colors
badge=I(cell, {type:"ref", ref:"YyFIQ"})  // SiteBadge (neutral)
```

---

## Step 1: Try the Index First

Read the index file:
```
Read: apps/web/mockup/design-system-index.json
```

**If the file exists and contains the component(s) you need:**
- Use the node IDs directly. **Stop here — do NOT scan.**

**If the file is missing or a needed component is not listed:**
- Proceed to Step 2 to rebuild/update the index.

---

## Step 2: Scan Once to Build / Update the Index

Only run this if Step 1 was insufficient.

1. Ensure `app.pen` is open (`get_editor_state` → `open_document` if needed)
2. Use `batch_get` to find the "Design System" frame:
   ```
   batch_get(patterns: ["Design System"])
   ```
3. From the result, collect:
   - The root frame node ID → `_frame`
   - Each direct child component name → its node ID
4. Write (or overwrite) `apps/web/mockup/design-system-index.json` with the full map
5. Proceed using the node IDs just retrieved

---

## Step 3: Keeping the Index Fresh

**After creating a new reusable component** in the Design System frame:
1. Add a copy of it to the Design System frame in `app.pen` (use `_frame` as parent)
2. Read the current index file
3. Add the new entry: `"ComponentName": "<new-node-id>"`
4. Write the updated file back

**When adding a new base + variant group:**
1. Create the neutral base component (frame, `reusable: true`)
2. Create each variant as a reusable ref pointing to the base (`type: "ref"`, `ref: "<base-id>"`, `reusable: true`), with color/content overrides in `descendants`
3. Add all entries to the index — base first, then variants
4. Add a `_comment_<group>` key documenting the pattern

**Never delete entries** unless you have confirmed the component was removed from the Design System frame.

---

## Usage in Export / Sync Tasks

```
// At the start of pen-export or pen-sync:
1. Load this skill (pen-design-system)
2. Read the index → get node IDs
3. For each shared component needed on the page:
   - Standard: C("<node-id>", "<page-frame-id>", { x: 0, y: <offset> })
   - Badge variant: I(cell, {type:"ref", ref:"<variant-node-id>"})
4. Build only page-specific content from scratch
```
