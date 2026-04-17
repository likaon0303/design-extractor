#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const src = path.join(os.homedir(), 'Downloads', 'design.md');
const dest = path.join(process.cwd(), 'design.md');

if (!fs.existsSync(src)) {
  console.error('✗ design.md not found in ~/Downloads');
  console.error('  Open the Design.md Extractor extension, extract a site, then click Install');
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log('✓ design.md installed →', dest);
