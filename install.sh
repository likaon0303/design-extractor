#!/bin/bash
# Design.md Installer for Claude Code
# Usage: cd /your/project && bash ~/design-extractor/install.sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(pwd)"

# Validate project directory
if [ "$SCRIPT_DIR" = "$PROJECT_DIR" ]; then
  echo "⚠ Run this from your project root:"
  echo "  cd /path/to/your/project && bash $0"
  exit 1
fi

# Verify design.md was copied
if [ -f "$PROJECT_DIR/design.md" ]; then
  echo "✓ design.md installed"
else
  echo "⚠ design.md not found in $PROJECT_DIR"
  echo "  Make sure to run: cp ~/Downloads/design-*.md ./design.md first"
  exit 1
fi

# Install commands
mkdir -p "$PROJECT_DIR/.claude/commands/design-extractor"
COMMANDS_DIR="$SCRIPT_DIR/commands/design-extractor"
if ls "$COMMANDS_DIR"/*.md 1>/dev/null 2>&1; then
  cp "$COMMANDS_DIR"/*.md "$PROJECT_DIR/.claude/commands/design-extractor/"
  echo "✓ Commands installed: /use-design, /update-design, /enrich-design"
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
echo "Design system ready. Run /enrich-design in Claude Code to add AI narrative to design.md."
