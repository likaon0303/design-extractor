// popup.js

let generatedMarkdown = '';
let currentTabUrl = '';
let downloadFilename = 'design.md';
const REPO = 'https://github.com/likaon0303/design-extractor';
let currentView = 'idle'; // idle | progress | result | error | settings
let previousView = 'idle'; // used to return from settings

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadCurrentTab();
  setupButtons();
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
  document.getElementById('progressHost').textContent = host;
}

async function loadSettings() {
  const { filename } = await chrome.storage.local.get('filename');
  if (filename) document.getElementById('filenameInput').value = filename;
}

function setupButtons() {
  document.getElementById('btnExtract').addEventListener('click', handleExtract);
  document.getElementById('btnRetry').addEventListener('click', handleRetry);
  document.getElementById('btnDownload').addEventListener('click', handleDownload);
  document.getElementById('btnCopyPreview').addEventListener('click', handleCopyPreview);
  document.getElementById('btnCopyCli').addEventListener('click', handleCopyCli);
  document.getElementById('btnSettings').addEventListener('click', handleSettings);
  document.getElementById('filenameInput').addEventListener('change', saveFilename);
}

// --- Navigation ---

function showView(name) {
  document.querySelectorAll('[data-view]').forEach(el => el.classList.remove('active'));
  const el = document.querySelector(`[data-view="${name}"]`);
  if (el) el.classList.add('active');
  currentView = name;
}

// --- Settings toggle ---

function handleSettings() {
  if (currentView === 'settings') {
    showView(previousView);
  } else {
    previousView = currentView;
    showView('settings');
  }
  const isSettings = currentView === 'settings';
  document.getElementById('iconGear').style.display  = isSettings ? 'none'  : 'block';
  document.getElementById('iconClose').style.display = isSettings ? 'block' : 'none';
}

// --- Extract flow ---

async function handleExtract() {
  showView('progress');
  resetSteps();

  try {
    setStep(1, 'active');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/extractor.js']
    });

    await delay(400);

    setStep(1, 'done');
    setStep(2, 'active');

    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: 'extractDesign' }, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res);
      });
    });

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
  document.getElementById('cliCmd').textContent = `[ -d ~/design-extractor ] || git clone ${REPO} ~/design-extractor; cp ~/Downloads/${downloadFilename} ./design.md && bash ~/design-extractor/install.sh`;

  showView('result');
}

async function handleCopyPreview() {
  if (!generatedMarkdown) return;
  await navigator.clipboard.writeText(generatedMarkdown);
  const btn = document.getElementById('btnCopyPreview');
  const orig = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = orig; }, 1500);
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
  const btn = document.getElementById('btnCopyCli');
  btn.style.color = 'var(--blue)';
  setTimeout(() => { btn.style.color = ''; }, 1500);
}

// --- Settings ---

async function saveFilename() {
  const filename = document.getElementById('filenameInput').value.trim() || 'design.md';
  await chrome.storage.local.set({ filename });
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
