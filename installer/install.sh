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
cp "$SCRIPT_DIR/commands/"*.md "$PROJECT_DIR/.claude/commands/design-extractor/"
echo "✓ Commands installed: /use-design, /update-design"

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
