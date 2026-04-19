# Enrich Design System

Read @design.md and enrich it with AI narrative sections.

## Process

1. Read the full content of `design.md` from the project root
2. Ask the user (using your interactive question tool with arrow key selection):

   **"design.md is ready. What would you like to do?"**

   Options:
   - **Enrich with AI narrative** — add narrative sections to design.md
   - **Use as-is** — design system is active and ready

3. If user chooses **Enrich with AI narrative**:
   - Add the following sections directly to `design.md` (append or insert after the last section):
     - **Visual Theme & Atmosphere** — 2-3 sentences on mood, color temperature, layout rhythm
     - **Typography Principles** — 3 bullets: font rationale, weight/tracking intent, hierarchy approach
     - **Shadow & Elevation Philosophy** — 1-2 sentences
     - **Interaction Philosophy** — 2 bullets: hover/focus meaning, motion language
     - **Example Prompts** — 3 ready-to-use prompts referencing exact token values from the file
   - Write the enriched content back to `design.md`
   - Confirm: "design.md enriched and ready."

4. If user chooses **Use as-is**:
   - Confirm: "Design system active. Use /use-design to load tokens into any conversation."
