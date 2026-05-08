# Enrich Design System

> **Step 0 — Find design.md** (run this first, before anything else)

Use the Glob tool to find `design.md`:
1. Search pattern: `design.md` (project root)
2. If not found, try: `**/design.md` (any subdirectory)

**Found — one file**: Read it. Tell the user:
> "Found design.md at `[path]` — [line count] lines, [size]KB"
> Then proceed to the wizard below.

**Found — multiple files**: Ask the user:
> "Found design.md in multiple locations. Which one should I use?"
> List all paths as selectable options.

**Not found**: Tell the user:
> "design.md not found in this project."
> Ask:
> - "Provide the path to your design.md file"
> - "I haven't extracted yet — open the Design.md Extractor Chrome extension first"
>
> If user provides a path, read from that path and continue.
> If user hasn't extracted yet, stop and explain: open the extension, click Extract, then Save to Project.

---

Read @design.md and transform it into a production-ready design system.

## Process

1. Read the full content of `design.md` from the project root
2. Ask the user (using your interactive question tool with arrow key selection):

   **"design.md is ready. How would you like to enrich it?"**

   Options:
   - **Transform to design system** — semantic tokens, component states, a11y rules, brand personality
   - **Narrative only** — add mood/atmosphere/typography narrative sections
   - **Use as-is** — design system is active and ready

---

## Option A: Transform to design system

Rewrite `design.md` in-place. Preserve all extracted raw data — add semantic layer on top. Follow these steps exactly:

### Step 1 — Rewrite YAML frontmatter with semantic token naming

Replace the existing `colors:` and `components:` YAML block with a semantic token structure. Map raw hex values to semantic roles by analyzing which colors appear most frequently and in what context:

```yaml
---
color:
  surface.base: "<page background hex>"
  surface.elevated: "<card/elevated surface hex>"
  surface.muted: "<subtle background hex>"
  text.primary: "<dominant body text hex>"
  text.secondary: "<secondary/muted text hex>"
  text.inverse: "<text on dark backgrounds>"
  interactive.default: "<primary CTA background>"
  interactive.hover: "<CTA hover — darken 5%>"
  interactive.pressed: "<CTA pressed — darken 10%>"
  interactive.outline: "<outline button text/border>"
  border.subtle: "<card/divider border>"
  focus.ring: "<focus-visible outline color>"
typography:
  font.family.primary: "<primary font name>"
  font.family.stack: "<full font stack>"
  font.size.xs: "<smallest>"
  font.size.sm: "<small>"
  font.size.md: "<base body>"
  font.size.lg: "<large body>"
  font.size.xl: "<subheading>"
  font.size.2xl: "<heading>"
  font.size.3xl: "<display>"
  font.size.4xl: "<hero>"
  font.weight.regular: "<regular weight>"
  font.weight.medium: "<medium weight>"
  font.weight.semibold: "<semibold weight>"
  font.weight.bold: "<bold weight>"
spacing:
  space.1: "<smallest spacing>"
  space.2: "..."
  space.3: "..."
  space.4: "<base unit>"
  space.6: "..."
  space.8: "..."
  space.12: "..."
  space.16: "..."
radius:
  radius.none: "0px"
  radius.sm: "<small radius>"
  radius.md: "<medium radius>"
  radius.lg: "<large radius>"
  radius.full: "<pill/circle radius>"
motion:
  motion.duration.instant: "100ms"
  motion.duration.fast: "200ms"
  motion.duration.normal: "<extracted transition duration>"
  motion.easing.standard: "<extracted cubic-bezier>"
components:
  button.primary:
    background: "{color.interactive.default}"
    text: "{color.text.inverse}"
    border: "none"
    radius: "{radius.sm or radius.full — match extracted value}"
    padding: "<extracted padding>"
  button.secondary:
    background: "transparent"
    text: "{color.interactive.default}"
    border: "1px solid {color.interactive.default}"
    radius: "{radius.sm or radius.full}"
  input.default:
    background: "{color.surface.base}"
    text: "{color.text.primary}"
    border: "1px solid {color.border.subtle}"
    radius: "{radius.sm}"
    focus-ring: "2px solid {color.focus.ring}"
---
```

Derive all values from the actual extracted data in `design.md`. Do not invent values.

### Step 2 — Add brand personality (after Visual Theme & Atmosphere)

Write 2–3 sentences describing design intent. Be specific — reference actual extracted values:
- What the color temperature communicates (warm/cool/neutral, why)
- What the typography choices signal (confidence, approachability, precision)
- What spacing/radius choices say about the brand (open/tight, soft/hard)

Then add one-sentence **Design Intent**:
> e.g. "Apple's visual language restricts color to interactive affordances only — hierarchy is achieved through scale and weight, never hue."

### Step 3 — Component state matrix

For each component found in `design.md` (buttons, inputs, navigation, cards), add a full state table after the existing component description:

```markdown
#### States

| State | Background | Text | Border | Outline | Opacity | Cursor |
|-------|-----------|------|--------|---------|---------|--------|
| default | {color.interactive.default} | {color.text.inverse} | none | none | 1 | pointer |
| hover | {color.interactive.hover} | {color.text.inverse} | none | none | 1 | pointer |
| focus-visible | {color.interactive.default} | {color.text.inverse} | none | 2px solid {color.focus.ring} | 1 | pointer |
| active | {color.interactive.pressed} | {color.text.inverse} | none | none | 1 | pointer |
| disabled | {color.interactive.default} | {color.text.inverse} | none | none | 0.42 | not-allowed |
| loading | {color.interactive.default} | transparent | none | none | 0.7 | wait |
```

Derive hover/pressed from extracted CSS or approximate by darkening the default by 5–10%. Use extracted `:focus-visible` CSS for the outline. Use extracted opacity values for disabled (Apple uses `--sk-link-disabled-opacity: .42`).

### Step 4 — Prescriptive rules rewrite

Replace the **Do's and Don'ts** section with prescriptive rules using `must`/`should`:

```markdown
## Design Rules

### Typography
- Every heading **must** use `{font.family.primary}` — system font substitutes are prohibited.
- Display text (≥ `{font.size.3xl}`) **must** use letter-spacing `<extracted value>` — never omit.
- Body copy **should** use `{font.size.md}` minimum for readability.
- Hierarchy **must** be established through size and weight — not color alone.
- Body text **must not** be bolded for emphasis — use size increase or `{color.interactive.default}` instead.

### Color
- `{color.interactive.default}` **must** be used only for primary CTAs and interactive affordances — never for decorative elements.
- Text on `{color.surface.base}` **must** use `{color.text.primary}` — never raw `#000000`.
- Disabled states **must** use `opacity: 0.42` — never a gray hex replacement.
- New colors **must not** be introduced — use opacity variants of existing palette tokens.

### Spacing
- All spacing **must** come from the defined scale — no magic numbers.
- Base unit is `{space.4}` — all layout values **must** be multiples of this unit.
- Component padding **must** be consistent within same component family.

### Components
- Every interactive element **must** have a visible `:focus-visible` ring — `2px solid {color.focus.ring}`.
- Hover states **must** be defined for every clickable element — color shift or opacity change.
- Disabled state **must** reduce opacity to 0.42, not change color.
- Border radius **must** use only values from the defined radius scale.
```

### Step 5 — Accessibility acceptance criteria

Add section after Design Rules:

```markdown
## Accessibility

Target: WCAG 2.2 AA

### Acceptance Criteria

**Color contrast**
- [ ] Body text on page background **must** achieve ≥ 4.5:1 — `{text.primary}` on `{surface.base}` = <calculated>:1 (<rating>)
- [ ] Interactive text/icons **must** achieve ≥ 3:1 against adjacent background
- [ ] Disabled elements are exempt from contrast requirements

**Keyboard navigation**
- [ ] All interactive elements **must** be reachable via Tab key
- [ ] Focus order **must** be logical and match visual order
- [ ] `:focus-visible` ring **must** be visible at 2px minimum — `2px solid {color.focus.ring}`
- [ ] No element **must** trap keyboard focus

**Touch targets**
- [ ] All interactive elements **must** have minimum 44×44px touch target
- [ ] CTA buttons **must** have at least `{space.3}` padding vertically

**Motion**
- [ ] All transitions **must** be disabled when `prefers-reduced-motion: reduce` is active
```

Calculate actual contrast ratios for the 2–3 most important color pairs from the WCAG table already present in `design.md`.

### Step 6 — Agent Prompt Guide enhancement

Rewrite the Agent Prompt Guide to reference semantic tokens instead of raw hex:

```markdown
## Agent Prompt Guide

Always load `design.md` before generating any UI component.

### Semantic Token Quick Reference

| Token | Value | Use |
|-------|-------|-----|
| `color.surface.base` | `<hex>` | Page background |
| `color.text.primary` | `<hex>` | All body text, headings |
| `color.interactive.default` | `<hex>` | Primary CTAs, links, brand moments |
| `color.focus.ring` | `<hex>` | Focus-visible outlines |
| `font.family.primary` | `<font>` | All UI text |
| `font.size.md` | `<size>` | Base body text |
| `radius.sm` | `<radius>` | Buttons, inputs |

### Example Prompts

Generate 3 ready-to-use prompts using semantic token names and actual extracted values. Each prompt must specify: component type, color tokens, typography tokens, spacing, states.
```

### Final output

Write the complete transformed `design.md` back to disk. Confirm: `"design.md transformed. Semantic tokens active — reference color.* / font.* / space.* in all prompts."`

---

## Option B: Narrative only

Add the following sections to `design.md` (append after last section). Preserve ALL existing data:

1. **Visual Theme & Atmosphere** — 2–3 sentences on mood, color temperature, layout rhythm. Reference actual extracted values.
2. **Typography Principles** — 3 bullets: font rationale, weight/tracking intent, hierarchy approach
3. **Shadow & Elevation Philosophy** — 1–2 sentences on what depth system communicates
4. **Interaction Philosophy** — 2 bullets: hover/focus meaning, motion language intent
5. **Example Prompts** — 3 ready-to-use prompts referencing exact token values from the file

Write enriched content back to `design.md`. Confirm: `"design.md enriched and ready."`

---

## Option C: Use as-is

Confirm: `"Design system active. Use /use-design to load tokens into any conversation."`
