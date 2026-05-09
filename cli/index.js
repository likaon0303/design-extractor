#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const COMMANDS_SRC = path.join(__dirname, 'commands');
const COMMANDS_DEST = path.join(os.homedir(), '.claude', 'commands', 'design-extractor');

// Install commands to ~/.claude/commands/design-extractor/
try {
  fs.mkdirSync(COMMANDS_DEST, { recursive: true });
  const files = fs.readdirSync(COMMANDS_SRC).filter(f => f.endsWith('.md'));
  files.forEach(file => {
    fs.copyFileSync(path.join(COMMANDS_SRC, file), path.join(COMMANDS_DEST, file));
  });
  console.log(`✓ Commands installed to ${COMMANDS_DEST}`);
  console.log(`  /design-extractor:enrich-design`);
  console.log(`  /design-extractor:use-design`);
  console.log(`  /design-extractor:update-design`);
} catch (err) {
  console.error('✗ Failed to install commands:', err.message);
  process.exit(1);
}

// Update CLAUDE.md if design.md exists in cwd
const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
const designMdPath = path.join(process.cwd(), 'design.md');

if (fs.existsSync(designMdPath)) {
  try {
    if (fs.existsSync(claudeMdPath)) {
      const content = fs.readFileSync(claudeMdPath, 'utf8');
      if (!content.includes('design.md')) {
        fs.appendFileSync(claudeMdPath, '\n## Design System\nSee @design.md for the complete design system.\n');
        console.log('✓ CLAUDE.md updated');
      } else {
        console.log('ℹ CLAUDE.md already references design.md — skipped');
      }
    } else {
      fs.writeFileSync(claudeMdPath, '## Design System\nSee @design.md for the complete design system.\n');
      console.log('✓ CLAUDE.md created');
    }
  } catch (err) {
    console.warn('⚠ Could not update CLAUDE.md:', err.message);
  }
}

console.log('\nRun /design-extractor:enrich-design in Claude Code to enrich your design.md');
