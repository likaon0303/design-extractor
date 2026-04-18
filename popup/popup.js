// popup.js

let generatedMarkdown = '';
let currentTabUrl = '';
let downloadFilename = 'design.md';
const REPO = 'https://github.com/likaon0303/design-extractor';
let currentView = 'idle';

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentTab();
  setupButtons();

  const { savedResult } = await chrome.storage.session.get('savedResult');
  if (savedResult) {
    const currentHostname = (() => { try { return new URL(currentTabUrl).hostname; } catch { return ''; } })();
    if (savedResult.hostname && savedResult.hostname !== currentHostname) {
      chrome.storage.session.remove('savedResult');
    } else {
      generatedMarkdown = savedResult.markdown;
      downloadFilename = savedResult.downloadFilename;
      document.getElementById('resultStats').textContent = savedResult.stats;
      const preview = savedResult.markdown.substring(0, 600) + (savedResult.markdown.length > 600 ? '\n...' : '');
      document.getElementById('resultPreview').textContent = preview;
      document.getElementById('cliCmd').textContent = savedResult.cliCmd;
      showView('result');
      return;
    }
  }
});

// --- Init ---

async function loadCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  currentTabUrl = tab.url;
  let host = tab.url;
  try {
    const u = new URL(tab.url);
    host = u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch {}
  document.getElementById('siteHost').textContent = host;
}

function setupButtons() {
  document.getElementById('btnExtract')?.addEventListener('click', handleExtract);
  document.getElementById('btnRetry')?.addEventListener('click', handleRetry);
  document.getElementById('btnRefresh')?.addEventListener('click', handleRetry);
  document.getElementById('btnDownload')?.addEventListener('click', handleDownload);
  document.getElementById('btnCopyPreview')?.addEventListener('click', handleCopyPreview);
  document.getElementById('btnCopyCli')?.addEventListener('click', handleCopyCli);
}

// --- Navigation ---

function showView(name) {
  document.querySelectorAll('[data-view]').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`[data-view="${name}"]`);
  if (el) el.classList.add('active');
  currentView = name;
  const subtitle = document.getElementById('subtitle');
  subtitle.classList.toggle('hidden', name === 'result' || name === 'error');
}

// --- Extract flow ---

async function handleExtract() {
  showView('progress');
  resetSteps();

  try {
    setStep(1, 'active');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/extractor.js']
    });

    await delay(400);

    setStep(1, 'done');
    setStep(2, 'active');

    const response = await Promise.race([
      new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'extractDesign' }, (res) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(res);
        });
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Extraction timed out (30s)')), 30000))
    ]);

    if (!response?.success) throw new Error(response?.error || 'Failed to extract design data');

    await delay(400);

    setStep(2, 'done');
    setStep(3, 'active');
    await delay(600);

    setStep(3, 'done');
    setStep(4, 'active');

    const markdown = await generateDesignMd(response.data);
    generatedMarkdown = markdown;

    setStep(4, 'done');
    await delay(200);

    showResult(markdown);

  } catch (err) {
    showError(err.message || 'Extraction failed. Please try again.');
    console.error('Extract error:', err);
  }
}

async function generateDesignMd(designData) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'generateDesignMd', data: designData },
      (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (response?.success) resolve(response.markdown);
        else reject(new Error(response?.error || 'Generation failed'));
      }
    );
  });
}

function handleRetry() {
  chrome.storage.session.remove('savedResult');
  showView('idle');
}

// --- Result actions ---

function showResult(markdown) {
  const lines = markdown.split('\n').length;
  const kb = Math.round(markdown.length / 1024 * 10) / 10;
  document.getElementById('resultStats').textContent = `${lines} lines/${kb}kb`;

  const preview = markdown.substring(0, 600) + (markdown.length > 600 ? '\n...' : '');
  document.getElementById('resultPreview').textContent = preview;

  const hostname = (() => {
    try { return new URL(currentTabUrl).hostname.replace(/\./g, '-'); } catch { return 'site'; }
  })();
  downloadFilename = `design-${hostname}.md`;
  document.getElementById('cliCmd').textContent = `[ -f ~/design-extractor/install.sh ] || git clone ${REPO} ~/design-extractor; cp ~/Downloads/${downloadFilename} ./design.md && bash ~/design-extractor/install.sh`;

  showView('result');

  chrome.storage.session.set({
    savedResult: {
      markdown,
      downloadFilename,
      cliCmd: document.getElementById('cliCmd').textContent,
      stats: document.getElementById('resultStats').textContent,
      hostname: (() => { try { return new URL(currentTabUrl).hostname; } catch { return ''; } })()
    }
  });
}

const COPY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>`;
const COPIED_HTML = '<span style="font-size:10px;font-family:var(--sans);letter-spacing:-0.03em;color:#196FE2">Copied!</span>';

function flashCopied(btn) {
  btn.innerHTML = COPIED_HTML;
  setTimeout(() => { btn.innerHTML = COPY_SVG; }, 1500);
}

async function handleCopyPreview() {
  if (!generatedMarkdown) return;
  await navigator.clipboard.writeText(generatedMarkdown);
  flashCopied(document.getElementById('btnCopyPreview'));
}

async function handleDownload() {
  if (!generatedMarkdown) return;
  const blob = new Blob([generatedMarkdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadFilename;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleCopyCli() {
  const cmd = document.getElementById('cliCmd').textContent;
  await navigator.clipboard.writeText(cmd);
  flashCopied(document.getElementById('btnCopyCli'));
}

// --- UI helpers ---

function resetSteps() {
  [1, 2, 3, 4].forEach(i => {
    const step = document.getElementById(`step${i}`);
    step.classList.remove('active', 'done');
  });
}

function setStep(num, state) {
  const step = document.getElementById(`step${num}`);
  step.classList.remove('active', 'done');
  if (state) step.classList.add(state);
}

function showError(msg) {
  document.getElementById('errorMsg').textContent = msg;
  showView('error');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
