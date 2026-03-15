const OLLAMA_URL = 'http://localhost:11434';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

let currentPRData = null;
let currentMode = 'groq';
let groqApiKey = '';
let groqModel = 'llama-3.1-8b-instant';

// ── STATE ──────────────────────────────────────────────────────
function showState(id) {
  document.querySelectorAll('.state').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function setLoadingStep(text) {
  const el = document.getElementById('loadingStep');
  if (el) el.textContent = text;
}

function updateFooter(mode) {
  const el = document.getElementById('footerText');
  const badge = document.getElementById('modeBadge');
  if (mode === 'groq') {
    if (el) el.textContent = '⚡ Groq · Fast inference';
    if (badge) badge.textContent = 'groq';
  } else {
    if (el) el.textContent = '🔒 Ollama · Runs locally';
    if (badge) badge.textContent = 'ollama';
  }
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const stored = await chrome.storage.local.get(['groqApiKey', 'groqModel', 'defaultMode']);
  groqApiKey = stored.groqApiKey || '';
  groqModel = stored.groqModel || 'llama-3.1-8b-instant';
  currentMode = stored.defaultMode || 'groq';

  // First time — show onboarding
  if (!groqApiKey) {
    showState('stateOnboard');
    wireButtons();
    return;
  }

  updateFooter(currentMode);
  await initPRDetection();
  wireButtons();
});

async function initPRDetection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url || !tab.url.match(/github\.com\/.*\/pull\/\d+/)) {
    showState('stateNotPR');
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractPR' });
    if (response?.success) {
      currentPRData = response.data;
      populatePRInfo(currentPRData);
      showState('stateReady');
      setModeUI(currentMode);
    } else {
      showState('stateNotPR');
    }
  } catch (e) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractPR' });
      if (response?.success) {
        currentPRData = response.data;
        populatePRInfo(currentPRData);
        showState('stateReady');
        setModeUI(currentMode);
      } else {
        showState('stateNotPR');
      }
    } catch {
      showState('stateNotPR');
    }
  }
}

function populatePRInfo(data) {
  const t = document.getElementById('prTitle');
  const a = document.getElementById('prAdditions');
  const d = document.getElementById('prDeletions');
  const f = document.getElementById('prFiles');
  if (t) t.textContent = data.title || 'Pull Request';
  if (a) a.textContent = `+${data.additions || 0}`;
  if (d) d.textContent = `−${data.deletions || 0}`;
  if (f) f.textContent = `${data.filesChanged || 0} files`;
}

// ── MODE SELECTOR ──────────────────────────────────────────────
function setModeUI(mode) {
  currentMode = mode;
  document.getElementById('modeGroq')?.classList.toggle('active', mode === 'groq');
  document.getElementById('modeOllama')?.classList.toggle('active', mode === 'ollama');
  const notice = document.getElementById('ollamaNotice');
  if (notice) notice.classList.toggle('show', mode === 'ollama');
  updateFooter(mode);

  // Warn if Groq selected but no key saved
  const btn = document.getElementById('btnSummarize');
  if (btn) {
    if (mode === 'groq' && !groqApiKey) {
      btn.textContent = '⚙ Add Groq API key in Settings';
      btn.style.background = 'var(--surface3)';
      btn.style.color = 'var(--text2)';
      btn.style.boxShadow = 'none';
    } else {
      btn.textContent = '⚡ Summarize PR';
      btn.style.background = '';
      btn.style.color = '';
      btn.style.boxShadow = '';
    }
  }
}

// ── WIRE BUTTONS ───────────────────────────────────────────────
function wireButtons() {
  // Onboarding
  document.getElementById('btnSaveKey')?.addEventListener('click', saveApiKey);

  // Mode selector
  document.getElementById('modeGroq')?.addEventListener('click', () => setModeUI('groq'));
  document.getElementById('modeOllama')?.addEventListener('click', () => setModeUI('ollama'));

  // Main actions
  document.getElementById('btnSummarize')?.addEventListener('click', summarize);
  document.getElementById('btnCopy')?.addEventListener('click', copyResults);
  document.getElementById('btnResummarize')?.addEventListener('click', () => {
    showState('stateReady');
    setModeUI(currentMode);
  });
  document.getElementById('btnTryAgain')?.addEventListener('click', () => {
    showState('stateReady');
    setModeUI(currentMode);
  });

  // Settings
  document.getElementById('btnSettings')?.addEventListener('click', openSettings);
  document.getElementById('btnSaveSettings')?.addEventListener('click', saveSettings);
  document.getElementById('btnCancelSettings')?.addEventListener('click', () => {
    showState('stateReady');
    setModeUI(currentMode);
  });
}

// ── API KEY ────────────────────────────────────────────────────
async function saveApiKey() {
  const input = document.getElementById('onboardKey');
  const key = input?.value.trim();
  if (!key || !key.startsWith('gsk_')) {
    if (input) { input.style.borderColor = 'var(--red)'; setTimeout(() => input.style.borderColor = '', 1500); }
    return;
  }
  groqApiKey = key;
  await chrome.storage.local.set({ groqApiKey: key });
  await initPRDetection();
  wireButtons();
}

// ── SETTINGS ───────────────────────────────────────────────────
function openSettings() {
  const keyInput = document.getElementById('settingsKey');
  const modelSelect = document.getElementById('settingsModel');
  if (keyInput) keyInput.value = groqApiKey;
  if (modelSelect) modelSelect.value = groqModel;
  showState('stateSettings');
}

async function saveSettings() {
  const key = document.getElementById('settingsKey')?.value.trim();
  const model = document.getElementById('settingsModel')?.value;
  if (key) { groqApiKey = key; }
  if (model) { groqModel = model; }
  await chrome.storage.local.set({ groqApiKey: groqApiKey, groqModel: groqModel, defaultMode: currentMode });
  showState('stateReady');
  setModeUI(currentMode);
}

// ── BUILD PROMPT ───────────────────────────────────────────────
function buildPrompt(data) {
  // Build structured file metadata for grounding
  const fileList = data.files && data.files.length > 0
    ? data.files.map(f => `  ${f.path} (+${f.additions || 0} -${f.deletions || 0})${f.isTest ? ' [test]' : ''}`).join('\n')
    : '  (file list unavailable)';

  const metaLines = [
    `Title: ${data.title || 'Unknown'}`,
    data.description ? `Description: ${data.description.slice(0, 400)}` : null,
    `Stats: +${data.additions || 0} added, -${data.deletions || 0} removed, ${data.filesChanged || 0} files`,
    data.testFilesChanged ? `Tests: test files were modified` : `Tests: no test files changed`,
    data.fileTypes?.length ? `File types: ${data.fileTypes.slice(0, 8).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  return `You are a senior software engineer reviewing a pull request. Be precise and grounded — only report what is directly visible in the diff.

=== PR METADATA ===
${metaLines}

=== FILES CHANGED ===
${fileList}

=== DIFF (changed lines only) ===
${(data.diff || 'No diff available').slice(0, 5500)}

=== INSTRUCTIONS ===
Produce your analysis in this EXACT format. Do not add extra sections.

SUMMARY:
- [FIRST bullet must state the core intent/reason for this PR — the "why", derived from the title and description]
- [remaining bullets describe specific code changes — what was added, modified, or removed]
(max 4 bullets total, be specific)

RISKS:
CRITICAL RULES for risks:
- Only list risks you can directly point to in the diff above
- Do NOT infer risks from file names, comments, copyright headers, or coding style
- Do NOT list risks about missing tests, documentation, or formatting
- Only flag: logic errors, security issues, race conditions, data corruption, broken error handling
- If you cannot point to a specific line of code that causes a problem, do not list it
- If no real risks exist, write exactly: none

QUESTIONS:
- [a specific question about the implementation logic, edge cases, or design decisions visible in the diff]
(max 3 questions, each must end with ?, must relate to actual code in the diff)`;
}

// ── SUMMARIZE ──────────────────────────────────────────────────
async function summarize() {
  if (!currentPRData) return;

  // Guard: missing Groq key in Groq mode
  if (currentMode === 'groq' && !groqApiKey) {
    showError('Add your Groq API key in Settings to enable summaries.');
    return;
  }

  showState('stateLoading');

  try {
    if (currentMode === 'groq') {
      await summarizeWithGroq();
    } else {
      await summarizeWithOllama();
    }
  } catch (e) {
    showError(e.message || 'Unknown error');
  }
}

async function summarizeWithGroq() {
  setLoadingStep('Calling Groq API...');

  if (!groqApiKey) {
    showState('stateOnboard');
    return;
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`
    },
    body: JSON.stringify({
      model: groqModel,
      messages: [{ role: 'user', content: buildPrompt(currentPRData) }],
      max_tokens: 800,
      temperature: 0.1
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 401) throw new Error('Invalid Groq API key. Check Settings.');
    if (res.status === 429) throw new Error('Groq rate limit hit. Wait a moment and retry.');
    throw new Error(err.error?.message || `Groq error: ${res.status}`);
  }

  setLoadingStep('Parsing response...');
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (!text) throw new Error('Empty response from Groq.');

  const parsed = parseResponse(text);
  renderResults(parsed);
  showState('stateResults');
}

async function summarizeWithOllama() {
  setLoadingStep('Checking Ollama...');

  try {
    const check = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!check.ok) throw new Error('ollama_down');
  } catch {
    showError('Ollama not running. Start Ollama or switch to Groq mode.');
    return;
  }

  setLoadingStep('Running local model...');

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5-coder:1.5b',
      prompt: buildPrompt(currentPRData),
      stream: false,
      options: { temperature: 0.1, num_predict: 800 }
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!res.ok) {
    const t = await res.text();
    if (t.includes('not found')) throw new Error('Model not found. Run: ollama pull qwen2.5-coder:1.5b');
    throw new Error(`Ollama error: ${res.status}`);
  }

  setLoadingStep('Parsing response...');
  const data = await res.json();
  const text = data.response || '';
  if (!text) throw new Error('Empty response from Ollama.');

  const parsed = parseResponse(text);
  renderResults(parsed);
  showState('stateResults');
}

// ── PARSE ──────────────────────────────────────────────────────
function parseResponse(text) {
  const result = { summary: [], risks: [], questions: [] };
  const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').trim();

  // Summary
  const summaryMatch = clean.match(/SUMMARY[:\s]+([\s\S]*?)(?=\nRISK|\nQUESTION|$)/i);
  if (summaryMatch) {
    result.summary = summaryMatch[1].split('\n')
      .map(l => l.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter(l => l.length > 8);
  }
  if (result.summary.length === 0) {
    result.summary = clean.split('\n')
      .filter(l => /^[-•*]\s/.test(l.trim()))
      .slice(0, 4)
      .map(l => l.replace(/^[-•*]\s*/, '').trim());
  }

  // Risks
  const risksMatch = clean.match(/RISKS?[:\s]+([\s\S]*?)(?=\nQUESTION|$)/i);
  if (risksMatch) {
    const rt = risksMatch[1].trim();
    if (/^none/i.test(rt) || /no (significant|real) risk/i.test(rt)) {
      result.risks = [];
    } else {
      result.risks = rt.split('\n')
        .filter(l => l.trim().length > 5 && !(/^none/i.test(l.trim())))
        .map(l => {
          const line = l.replace(/^[-•*\d.]+\s*/, '').trim();
          if (line.includes('|')) {
            const [a, b] = line.split('|');
            return { title: a.replace(/^RISK:\s*/i, '').trim(), detail: b.replace(/^DETAIL:\s*/i, '').trim() };
          }
          if (line.includes(':')) {
            const idx = line.indexOf(':');
            return { title: line.slice(0, idx).trim(), detail: line.slice(idx + 1).trim() };
          }
          return { title: line, detail: '' };
        })
        .filter(r => r.title.length > 2);
    }
  }

  // Questions
  const qMatch = clean.match(/QUESTIONS?[:\s]+([\s\S]*?)$/i);
  if (qMatch) {
    result.questions = qMatch[1].split('\n')
      .map(l => l.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter(l => l.length > 8);
  }
  if (result.questions.length === 0) {
    result.questions = clean.split('\n')
      .map(l => l.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter(l => l.endsWith('?') && l.length > 10)
      .slice(0, 3);
  }

  return result;
}

// ── RENDER ─────────────────────────────────────────────────────
function renderResults(parsed) {
  const c = document.getElementById('resultsContent');
  if (!c) return;

  let html = '';

  // Summary
  html += `<div class="result-section">
    <div class="section-head"><div class="sh-dot g"></div>What changed</div>
    <div class="section-body">
      ${parsed.summary.map(s => `<div class="s-bullet">${esc(s)}</div>`).join('') || '<div class="s-bullet">No summary available.</div>'}
    </div>
  </div>`;

  // Risks
  html += `<div class="result-section">
    <div class="section-head"><div class="sh-dot r"></div>Risk areas</div>
    <div class="section-body">`;
  if (parsed.risks.length === 0) {
    html += `<div class="no-risk">No significant risks detected</div>`;
  } else {
    parsed.risks.forEach(r => {
      html += `<div class="risk-card">
        <div class="risk-card-title">⚠ ${esc(r.title)}</div>
        ${r.detail ? `<div class="risk-card-body">${esc(r.detail)}</div>` : ''}
      </div>`;
    });
  }
  html += `</div></div>`;

  // Questions
  if (parsed.questions.length > 0) {
    html += `<div class="result-section">
      <div class="section-head"><div class="sh-dot b"></div>Questions to ask</div>
      <div class="section-body">
        ${parsed.questions.map(q => `<div class="q-card"><span class="q-label">Q</span>${esc(q)}</div>`).join('')}
      </div>
    </div>`;
  }

  c.innerHTML = html;
}

// ── COPY ───────────────────────────────────────────────────────
async function copyResults() {
  const c = document.getElementById('resultsContent');
  if (!c) return;

  let text = 'ReviewLens Summary\n' + '='.repeat(40) + '\n\n';
  c.querySelectorAll('.section').forEach(sec => {
    const title = sec.querySelector('.section-header')?.innerText?.trim();
    const body = sec.querySelector('.section-body')?.innerText?.trim();
    if (title && body) text += `${title}\n${body}\n\n`;
  });

  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('btnCopy');
    if (btn) { btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = '📋 Copy', 1500); }
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

// ── HELPERS ────────────────────────────────────────────────────
function showError(msg) {
  document.getElementById('errorMessage').textContent = msg;
  showState('stateError');
}

function esc(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
