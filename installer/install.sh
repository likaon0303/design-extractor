#!/bin/bash
# Design.md Installer for Claude Code
# Usage: cd /your/project && bash /path/to/install.sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(pwd)"

# Validate project directory
if [ "$SCRIPT_DIR" = "$PROJECT_DIR" ]; then
  echo "⚠ Run this from your project root:"
  echo "  cd /path/to/your/project && bash $0"
  exit 1
fi

# Install commands
mkdir -p "$PROJECT_DIR/.claude/commands/design-extractor"
COMMANDS_DIR="$SCRIPT_DIR/../commands/design-extractor"
if ls "$COMMANDS_DIR"/*.md 1>/dev/null 2>&1; then
  cp "$COMMANDS_DIR"/*.md "$PROJECT_DIR/.claude/commands/design-extractor/"
  echo "✓ Commands installed: /use-design, /update-design"
else
  echo "⚠ Command files not found in $COMMANDS_DIR"
fi

# Update CLAUDE.md
CLAUDE_MD="$PROJECT_DIR/CLAUDE.md"
DESIGN_ENTRY="@design.md"
if [ -f "$CLAUDE_MD" ]; then
  if ! grep -q "design.md" "$CLAUDE_MD"; then
    printf "\n## Design System\nSee %s for the complete design system.\n" "$DESIGN_ENTRY" >> "$CLAUDE_MD"
    echo "✓ CLAUDE.md updated"
  else
    echo "ℹ CLAUDE.md already references design.md — skipped"
  fi
else
  printf "## Design System\nSee %s for the complete design system.\n" "$DESIGN_ENTRY" > "$CLAUDE_MD"
  echo "✓ CLAUDE.md created"
fi

echo ""
echo "Done! Use /use-design in Claude Code to activate the design system."

# Background AI enrichment — adds narrative prose to design.md (requires claude CLI)
if command -v claude &>/dev/null && [ -f "$PROJECT_DIR/design.md" ]; then
  ENRICH_PROMPT="$COMMANDS_DIR/enrich-design.md"
  if [ -f "$ENRICH_PROMPT" ]; then
    (
      ENRICHED="/tmp/design_enriched_$$.md"
      DESIGN_CONTENT=$(cat "$PROJECT_DIR/design.md")
      PROMPT=$(cat "$ENRICH_PROMPT")
      cd "$PROJECT_DIR"
      printf '%s\n\n---\nCURRENT DESIGN.MD:\n%s' "$PROMPT" "$DESIGN_CONTENT" \
        | claude -p --dangerously-skip-permissions \
        > "$ENRICHED" 2>/dev/null
      if [ -s "$ENRICHED" ] && grep -q "DESIGN.md" "$ENRICHED"; then
        cp "$PROJECT_DIR/design.md" "$PROJECT_DIR/design.md.bak" 2>/dev/null
        mv "$ENRICHED" "$PROJECT_DIR/design.md"
        echo "✓ design.md enriched with AI narrative"
      fi
      rm -f "$ENRICHED"
    ) &
    echo "⟳ AI enrichment running in background (~30s) — design.md will be updated automatically"
  fi
fi
