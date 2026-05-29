/* ─── AvinashGPT · app.js ─── */

const SYSTEM_PROMPT = `You are AvinashGPT, an expert AI coding assistant built by Avinash Kumar.

PERSONALITY:
- Calm, precise, senior-engineer tone — like doing a code review.
- Think step-by-step before writing any code or fix.
- If something is ambiguous, ask ONE clarifying question first.
- Never guess or hallucinate APIs / methods.

CODE GENERATION RULES:
- Write clean, production-ready code with meaningful variable names.
- Add inline comments for non-obvious logic.
- Follow language conventions: PEP8 for Python, camelCase for JS/TS, snake_case for Go/Rust, etc.
- Structure code: imports → config/constants → helper functions → main logic → output/exports.

DEBUGGING RULES:
- First identify the root cause in 1–2 lines.
- Then explain what was wrong vs. what was fixed (diff-style).
- Never silently fix bugs — always explain why the original code failed.

FORMATTING RULES — CRITICAL:
- Always wrap code in fenced code blocks with the correct language label (e.g., \`\`\`python, \`\`\`javascript, \`\`\`sql).
- For multi-step answers, use numbered steps with clear section headings.
- For comparisons, use clearly separated sections or a side-by-side view.
- Keep explanations concise but complete — no fluff, no over-explanation.
- Use inline \`code\` for variable names, function names, and short expressions in prose.

SPECIALIZATIONS — ALL TYPES OF CODING:
- Languages:  Python, JavaScript, TypeScript, Java, C, C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, Dart, Scala, R, MATLAB, Lua, Haskell, Elixir, Clojure
- Web:        HTML, CSS, React, Next.js, Vue, Angular, Svelte, Node.js, Express, FastAPI, Django, Flask, REST APIs, GraphQL, WebSockets
- Mobile:     Flutter, React Native, Android (Kotlin/Java), iOS (Swift/SwiftUI)
- Databases:  SQL Server, MySQL, PostgreSQL, MongoDB, Redis, SQLite, Oracle, Cassandra, DynamoDB, Elasticsearch
- Data/Cloud: PySpark, Apache Spark, Databricks, Delta Lake, Azure Data Factory, AWS (S3, Lambda, EC2, Glue, Athena), GCP, Hadoop, Kafka, Airflow
- DevOps:     Docker, Kubernetes, Terraform, GitHub Actions, CI/CD pipelines, Linux/Bash scripting, Ansible, Helm
- AI/ML:      Python (NumPy, Pandas, Scikit-learn, TensorFlow, PyTorch), LangChain, HuggingFace, Prompt Engineering, RAG, OpenAI API, Anthropic API
- Testing:    Unit testing, Integration testing, TDD/BDD, Selenium, Pytest, JUnit, Jest, Cypress, Postman, k6

RESPONSE ENDING:
Always end complex answers (multi-step, debugging, architecture) with:
💡 Key Takeaway: [one concise sentence summarizing the most important point]

Keep responses focused, well-structured, and formatted for developer readability.`;

const AGENT_SYSTEM_PROMPT = `You are AvinashGPT in AGENT MODE — an autonomous AI assistant.

You have access to tools you can call:

1. web_search(query) — Search the internet for current info, docs, news, package versions.
2. read_file(filename, content) — Analyze a file the user has attached (content is provided).
3. write_file(filename, content) — Generate a complete file for the user to download.
4. run_code(language, code) — Show code to run, with expected output explained.
5. open_url(url) — Fetch and read the content of any webpage. Use this to read documentation, articles, GitHub repos, or any URL the user mentions.

AGENT BEHAVIOR:
- When you need current info, use web_search.
- When user attaches files, use read_file to analyze them.
- Think step by step. Plan before acting.
- After using a tool, show the result clearly and continue.
- Be autonomous — just use tools when needed.

TO USE A TOOL, respond with this exact format:
<tool_call>
{"tool": "web_search", "query": "your search query"}
</tool_call>

TOOL FORMATS:
- web_search: {"tool": "web_search", "query": "search terms..."}
- read_file:  {"tool": "read_file", "filename": "file.txt", "content": "file contents..."}
- write_file: {"tool": "write_file", "filename": "output.py", "content": "full file content..."}
- run_code:   {"tool": "run_code", "language": "python", "code": "# code here..."}
- open_url:   {"tool": "open_url", "url": "https://example.com"}

After a tool result is shown, continue with your analysis.

FORMATTING: Same as normal mode — code blocks, numbered steps, Key Takeaway at end.`;

/* ─── State ─── */
let conversationHistory = [];
let isLoading = false;
let currentAttachments = [];
let lastUserMessage = ''; // IMPROVED: For regenerate
let lastUserBubbleHtml = ''; // IMPROVED: For regenerate
let currentChatId = null; // IMPROVED: For chat history
let agentMode = false;
let enabledTools = new Set(['web_search', 'read_file', 'write_file', 'run_code', 'open_url']);
let pyodideInstance = null;

/* ─── Memory helpers ─── */
function getMemories() { return JSON.parse(localStorage.getItem('avinash_memories') || '[]'); }
function saveMemories(arr) { localStorage.setItem('avinash_memories', JSON.stringify(arr)); }
function addMemory(content, category, source) {
  let arr = getMemories();
  if (arr.length >= 100) {
    const unpinned = arr.filter(m => !m.pinned);
    if (unpinned.length) {
      unpinned.sort((a, b) => a.timestamp - b.timestamp);
      arr = arr.filter(m => m.id !== unpinned[0].id);
    }
  }
  arr.push({ id: 'mem_' + Math.random().toString(36).slice(2, 8), content, category, source, timestamp: Date.now(), pinned: false });
  saveMemories(arr);
  updateMemoryBadge();
}
function deleteMemory(id) {
  let arr = getMemories().filter(m => m.id !== id);
  saveMemories(arr);
  updateMemoryBadge();
}
function clearAllMemories() { localStorage.removeItem('avinash_memories'); updateMemoryBadge(); }

/* ─── DOM refs ─── */
const messagesEl  = document.getElementById('messages');
const inputEl     = document.getElementById('user-input');
const sendBtn     = document.getElementById('send-btn');
const clearBtn    = document.getElementById('clear-btn');
const newChatBtn  = document.getElementById('new-chat-btn');
const sidebarEl   = document.getElementById('sidebar');
const toggleBtn   = document.getElementById('sidebar-toggle');
// api-key-btn removed — managed via Settings modal
const uploadBtn   = document.getElementById('upload-btn');
const fileInput   = document.getElementById('file-input');
const previewArea = document.getElementById('preview-area');
const modelSelect = document.getElementById('model-select'); // IMPROVED
const themeToggle = document.getElementById('theme-toggle'); // IMPROVED
const exportBtn   = document.getElementById('export-btn');   // IMPROVED
const statusDot   = document.getElementById('status-dot');   // IMPROVED
const statusText  = document.getElementById('status-text');  // IMPROVED
const charCounter = document.getElementById('char-counter'); // IMPROVED
const scrollBtn   = document.getElementById('scroll-bottom-btn'); // IMPROVED
const dropOverlay = document.getElementById('drop-overlay'); // IMPROVED
const lightbox    = document.getElementById('lightbox');     // IMPROVED
const lightboxImg = document.getElementById('lightbox-img'); // IMPROVED
const agentToggle = document.getElementById('agent-mode-toggle');
const agentToolsList = document.getElementById('agent-tools-list');
const agentStatusBar = document.getElementById('agent-status-bar');
const agentStatusText = document.getElementById('agent-status-text');

/* ─── Agent Mode ─── */
agentToggle?.addEventListener('change', () => {
  agentMode = agentToggle.checked;
  agentToolsList.style.display = agentMode ? 'flex' : 'none';
  agentStatusBar.style.display = agentMode ? 'flex' : 'none';
  document.querySelectorAll('.agent-only').forEach(el => {
    el.style.display = agentMode ? 'flex' : 'none';
  });
  inputEl.placeholder = agentMode
    ? 'Ask me to search the web, analyze files, write code...'
    : 'Ask me to write, debug, or explain any code...';
  document.getElementById('footer-note').textContent = agentMode
    ? 'AvinashGPT · Agent Mode'
    : 'AvinashGPT · Powered by Groq';
  updateAgentBadges();
});

document.querySelectorAll('.tool-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const tool = chip.dataset.tool;
    chip.classList.toggle('active');
    if (chip.classList.contains('active')) enabledTools.add(tool);
    else enabledTools.delete(tool);
    updateAgentBadges();
  });
});

function updateAgentBadges() {
  const badgeEl = document.getElementById('agent-tool-badges');
  if (!badgeEl) return;
  badgeEl.innerHTML = [...enabledTools].map(t => {
    const icons = { web_search: 'ti-world-search', read_file: 'ti-file-search', write_file: 'ti-file-pencil', run_code: 'ti-terminal-2', open_url: 'ti-world-www' };
    const labels = { web_search: 'Web', read_file: 'Read', write_file: 'Write', run_code: 'Code', open_url: 'URL' };
    return '<span class="agent-badge"><i class="ti ' + icons[t] + '"></i>' + labels[t] + '</span>';
  }).join('');
}

/* ─── Tool Execution ─── */
async function executeTool(toolCall) {
  const tool = toolCall.tool;

  if (tool === 'web_search') {
    const query = toolCall.query || '';
    addToolBubble('web_search', 'Searching: "' + query + '"');
    agentStatusText.textContent = 'Searching: "' + query + '"';
    try {
      const tavilyKey = localStorage.getItem('tavily_api_key');
      if (tavilyKey) {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ api_key: tavilyKey, query: query, search_depth: 'basic', max_results: 5 })
        });
        const data = await res.json();
        if (data.results && data.results.length) {
          const result = data.results.map(r => 'Title: ' + (r.title || '') + '\nURL: ' + (r.url || '') + '\nSnippet: ' + (r.content || '') + '\n').join('\n');
          return { tool, query, result };
        }
      }
      const url = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1';
      const res = await fetch(url);
      const data = await res.json();
      const abstract = data.AbstractText || '';
      const related = (data.RelatedTopics || []).slice(0, 3).map(t => t.Text || t.Result || '').filter(Boolean).join('\n');
      const answer = data.Answer || '';
      const result = [answer, abstract, related].filter(Boolean).join('\n\n') || ('Search attempted for "' + query + '". Using model knowledge.');
      return { tool, query, result };
    } catch (e) {
      return { tool, query, result: 'Search attempted. Using model\'s training knowledge.' };
    }
  }

  if (tool === 'read_file') {
    addToolBubble('read_file', 'Reading: "' + toolCall.filename + '"');
    return { tool, filename: toolCall.filename, result: toolCall.content || 'File content provided in conversation.' };
  }

  if (tool === 'write_file') {
    addToolBubble('write_file', 'Writing: "' + toolCall.filename + '"');
    const blob = new Blob([toolCall.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = toolCall.filename; a.click();
    URL.revokeObjectURL(url);
    return { tool, filename: toolCall.filename, result: 'File "' + toolCall.filename + '" has been created and downloaded.' };
  }

  if (tool === 'run_code') {
    const language = toolCall.language || 'python';
    const code = toolCall.code || '';
    addToolBubble('run_code', 'Executing ' + language + ' code...');
    agentStatusText.textContent = 'Running ' + language + '...';
    try {
      if (language === 'javascript' || language === 'js') {
        let result = String(eval(code));
        return { tool, language, result: result || 'Code executed (no return value).' };
      }
      if (!pyodideInstance) {
        addToolBubble('run_code', 'Loading Python runtime...');
        pyodideInstance = await loadPyodide();
      }
      pyodideInstance.runPython('import sys, io; sys.stdout = io.StringIO()');
      await pyodideInstance.runPythonAsync(code);
      let output = pyodideInstance.runPython('sys.stdout.getvalue()');
      return { tool, language, result: output || 'Code executed (no output).' };
    } catch (e) {
      return { tool, language, result: 'Error: ' + e.message };
    }
  }

  if (tool === 'open_url') {
    const url = toolCall.url || '';
    addToolBubble('open_url', 'Fetching: ' + url);
    agentStatusText.textContent = 'Fetching URL...';
    try {
      const res = await fetch('https://r.jina.ai/' + url);
      let text = await res.text();
      if (text.length > 3000) text = text.substring(0, 3000) + '\n...[truncated]';
      return { tool, url, result: text || 'Page content is empty.' };
    } catch (e) {
      return { tool, url, result: 'Error fetching URL: ' + e.message };
    }
  }

  return { tool, result: 'Unknown tool.' };
}

function addToolBubble(tool, message) {
  const icons = { web_search: '🔍', read_file: '📂', write_file: '💾', run_code: '⚡', open_url: '🌐' };
  const div = document.createElement('div');
  div.className = 'tool-call-bubble';
  div.innerHTML = '<span class="tool-call-icon">' + (icons[tool] || '🔧') + '</span><span class="tool-call-text">' + escapeHtml(message) + '</span><span class="tool-call-spinner"></span>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function resolveToolBubble(bubble) {
  if (!bubble) return;
  var spinner = bubble.querySelector('.tool-call-spinner');
  if (spinner) spinner.remove();
  bubble.innerHTML += '<span class="tool-call-done"> Done</span>';
}

function parseToolCall(text) {
  var match = text.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch (e) {
    return null;
  }
}

/* ─── Settings defaults ─── */
const DEFAULT_SYSTEM_PROMPT = `You are AvinashGPT, an expert AI coding assistant built by Avinash Kumar.

PERSONALITY:
- Calm, precise, senior-engineer tone — like doing a code review.
- Think step-by-step before writing any code or fix.
- If something is ambiguous, ask ONE clarifying question first.
- Never guess or hallucinate APIs / methods.

CODE GENERATION RULES:
- Write clean, production-ready code with meaningful variable names.
- Add inline comments for non-obvious logic.
- Follow language conventions: PEP8 for Python, camelCase for JS/TS, snake_case for Go/Rust.
- Structure code: imports → config/constants → helper functions → main logic → output/exports.

FORMATTING RULES:
- Always wrap code in fenced code blocks with the correct language label.
- For multi-step answers, use numbered steps with clear section headings.
- Keep explanations concise but complete — no fluff, no over-explanation.
- Use inline \`code\` for variable names, function names, and short expressions in prose.

RESPONSE ENDING:
Always end complex answers with:
💡 Key Takeaway: [one concise sentence summarizing the most important point]`;

const SETTINGS_DEFAULTS = {
  maxTokens: 1500,
  agentLoopLimit: 5,
  fontSize: 14,
  density: 'comfortable',
  customSystemPrompt: ''
};

function getSettings() {
  try {
    return Object.assign({}, SETTINGS_DEFAULTS, JSON.parse(localStorage.getItem('avinash_settings') || '{}'));
  } catch { return { ...SETTINGS_DEFAULTS }; }
}

function saveSettingsToStorage(obj) {
  localStorage.setItem('avinash_settings', JSON.stringify(obj));
}

/* ─── API key management ─── */
function getApiKey() {
  const key = localStorage.getItem('groq_api_key');
  if (!key) {
    document.getElementById('api-key-modal').style.display = 'flex';
    return null;
  }
  return key;
}

window.saveQuickApiKey = function() {
  const input = document.getElementById('quick-api-key-input');
  const key = input.value.trim();
  if (!key || !key.startsWith('gsk_')) {
    document.getElementById('quick-api-key-error').style.display = 'block';
    return;
  }
  document.getElementById('quick-api-key-error').style.display = 'none';
  localStorage.setItem('groq_api_key', key);
  closeApiKeyModal();
  addMessage('bot', '<span style="color:#86efac;">✓ API key saved. You\'re all set!</span>');
};

window.closeApiKeyModal = function() {
  document.getElementById('api-key-modal').style.display = 'none';
};

window.addEventListener('load', () => {
  if (!localStorage.getItem('groq_api_key')) {
    setTimeout(() => { const m = document.getElementById('api-key-modal'); if (m) m.style.display = 'flex'; }, 300);
  }
});

/* ─── Settings Modal ─── */
window.openSettings = function() {
  const s = getSettings();
  // Populate API keys
  document.getElementById('api-key-input').value = localStorage.getItem('groq_api_key') || '';
  document.getElementById('tavily-key-input').value = localStorage.getItem('tavily_api_key') || '';

  // Model cards
  const currentModel = modelSelect?.value || 'meta-llama/llama-4-scout-17b-16e-instruct';
  document.querySelectorAll('.model-card').forEach(card => {
    card.classList.toggle('active', card.dataset.model === currentModel);
  });

  // Sliders
  document.getElementById('max-tokens-slider').value = s.maxTokens;
  document.getElementById('max-tokens-val').textContent = s.maxTokens;
  document.getElementById('agent-loop-slider').value = s.agentLoopLimit;
  document.getElementById('agent-loop-val').textContent = s.agentLoopLimit;
  document.getElementById('font-size-slider').value = s.fontSize;
  document.getElementById('font-size-val').textContent = s.fontSize + 'px';

  // Theme cards
  const currentTheme = localStorage.getItem('theme') || 'dark';
  document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === currentTheme));

  // Density
  document.querySelectorAll('.density-card').forEach(c => c.classList.toggle('active', c.dataset.density === s.density));

  // Agent tool toggles — sync with enabledTools
  ['web_search','read_file','write_file','run_code','open_url'].forEach(t => {
    const el = document.getElementById('tool-' + t);
    if (el) el.checked = enabledTools.has(t);
  });

  // System prompt
  const promptEl = document.getElementById('custom-system-prompt');
  promptEl.value = s.customSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  updatePromptCharCount();

  // Data stats
  const chats = JSON.parse(localStorage.getItem('chat_history') || '[]');
  document.getElementById('chat-count').textContent = chats.length;
  const storageBytes = new Blob([JSON.stringify(localStorage)]).size;
  document.getElementById('storage-used').textContent = storageBytes > 1024
    ? (storageBytes / 1024).toFixed(1) + ' KB'
    : storageBytes + ' B';

  renderMemoryList('all');
  const countBadge = document.getElementById('memory-count-badge');
  if (countBadge) countBadge.textContent = getMemories().length;

  document.getElementById('settings-modal').style.display = 'flex';
  // Activate first tab
  activateSettingsTab('api');
};

window.closeSettings = function() {
  document.getElementById('settings-modal').style.display = 'none';
};

window.saveSettings = function() {
  // API keys
  const groqKey = document.getElementById('api-key-input').value.trim();
  if (groqKey && !groqKey.startsWith('gsk_')) {
    document.getElementById('api-key-error').style.display = 'block';
    activateSettingsTab('api');
    return;
  }
  document.getElementById('api-key-error').style.display = 'none';
  if (groqKey) localStorage.setItem('groq_api_key', groqKey);
  const tavilyKey = document.getElementById('tavily-key-input').value.trim();
  if (tavilyKey) localStorage.setItem('tavily_api_key', tavilyKey);

  // Model
  const selectedModel = document.querySelector('.model-card.active')?.dataset.model;
  if (selectedModel) {
    modelSelect.value = selectedModel;
    localStorage.setItem('selected_model', selectedModel);
  }

  // Sliders
  const maxTokens = parseInt(document.getElementById('max-tokens-slider').value);
  const agentLoopLimit = parseInt(document.getElementById('agent-loop-slider').value);
  const fontSize = parseInt(document.getElementById('font-size-slider').value);

  // Theme
  const selectedTheme = document.querySelector('.theme-card.active')?.dataset.theme || 'dark';
  localStorage.setItem('theme', selectedTheme);
  if (selectedTheme === 'light') {
    document.body.classList.add('light');
    themeToggle.innerHTML = '<i class="ti ti-moon"></i>';
  } else {
    document.body.classList.remove('light');
    themeToggle.innerHTML = '<i class="ti ti-sun"></i>';
  }

  // Density
  const density = document.querySelector('.density-card.active')?.dataset.density || 'comfortable';

  // Agent tools
  ['web_search','read_file','write_file','run_code','open_url'].forEach(t => {
    const el = document.getElementById('tool-' + t);
    if (!el) return;
    if (el.checked) enabledTools.add(t);
    else enabledTools.delete(t);
    // Sync sidebar chip
    const chip = document.querySelector('.tool-chip[data-tool="' + t + '"]');
    if (chip) chip.classList.toggle('active', el.checked);
  });
  updateAgentBadges();

  // System prompt
  const customPrompt = document.getElementById('custom-system-prompt').value.trim();

  const newSettings = { maxTokens, agentLoopLimit, fontSize, density, customSystemPrompt: customPrompt };
  saveSettingsToStorage(newSettings);
  applySettings(newSettings);

  closeSettings();
  addMessage('bot', '<span style="color:#86efac;">✓ Settings saved.</span>');
};

function applySettings(s) {
  const el = document.getElementById('messages');
  if (!el) return;
  el.style.fontSize = s.fontSize + 'px';
  el.dataset.density = s.density;
}

/* ─── Settings tabs ─── */
function activateSettingsTab(tabId) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabId));
}

function updatePromptCharCount() {
  const el = document.getElementById('custom-system-prompt');
  const count = document.getElementById('prompt-char-count');
  if (el && count) count.textContent = el.value.length + ' chars';
}

window.resetSystemPrompt = function() {
  document.getElementById('custom-system-prompt').value = DEFAULT_SYSTEM_PROMPT;
  updatePromptCharCount();
};

window.toggleReveal = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.innerHTML = isPassword ? '<i class="ti ti-eye-off"></i>' : '<i class="ti ti-eye"></i>';
};

/* ─── Data actions ─── */
window.exportAllChats = function() {
  const chats = JSON.parse(localStorage.getItem('chat_history') || '[]');
  if (!chats.length) { alert('No chats to export.'); return; }
  let md = '# AvinashGPT — All Chats Export\n\n';
  chats.forEach((chat, i) => {
    md += '## Chat ' + (i + 1) + ': ' + chat.title + '\n\n';
    (chat.history || []).forEach(msg => {
      const role = msg.role === 'user' ? '**You**' : '**AvinashGPT**';
      const content = typeof msg.content === 'string' ? msg.content :
        (Array.isArray(msg.content) ? msg.content.map(b => b.text || '[image]').join('\n') : '');
      md += role + ': ' + content + '\n\n';
    });
    md += '---\n\n';
  });
  md += '*Exported on ' + new Date().toLocaleString() + '*';
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'AvinashGPT-all-chats.md'; a.click();
  URL.revokeObjectURL(url);
};

window.confirmClearChats = function() {
  const box = document.getElementById('data-confirm-box');
  document.getElementById('data-confirm-msg').textContent = 'This will permanently delete all saved chat history. Are you sure?';
  document.getElementById('data-confirm-yes').onclick = () => {
    localStorage.removeItem('chat_history');
    loadChatHistory();
    box.style.display = 'none';
    document.getElementById('chat-count').textContent = '0';
    document.getElementById('storage-used').textContent = '0 B';
    addMessage('bot', '<span style="color:#86efac;">✓ Chat history cleared.</span>');
  };
  box.style.display = 'block';
};

window.confirmFactoryReset = function() {
  const box = document.getElementById('data-confirm-box');
  document.getElementById('data-confirm-msg').textContent = 'This will delete ALL data including API keys, settings, and chat history. Cannot be undone.';
  document.getElementById('data-confirm-yes').onclick = () => {
    localStorage.clear();
    location.reload();
  };
  box.style.display = 'block';
};

/* ─── Theme toggle (IMPROVED) ─── */
function loadTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('light');
    if (themeToggle) themeToggle.innerHTML = '<i class="ti ti-moon"></i>';
  } else {
    document.body.classList.remove('light');
    if (themeToggle) themeToggle.innerHTML = '<i class="ti ti-sun"></i>';
  }
}
loadTheme();

themeToggle?.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  themeToggle.innerHTML = isLight ? '<i class="ti ti-moon"></i>' : '<i class="ti ti-sun"></i>';
});

/* ─── Model selector (IMPROVED) ─── */
function loadModel() {
  const saved = localStorage.getItem('selected_model');
  if (saved && modelSelect) modelSelect.value = saved;
}
loadModel();
modelSelect?.addEventListener('change', () => {
  localStorage.setItem('selected_model', modelSelect.value);
});

/* ─── Sidebar toggle (IMPROVED: localStorage) ─── */
function loadSidebarState() {
  const collapsed = localStorage.getItem('sidebar_collapsed');
  if (collapsed === 'true' && sidebarEl) sidebarEl.classList.add('collapsed');
}
loadSidebarState();

toggleBtn?.addEventListener('click', () => {
  sidebarEl.classList.toggle('collapsed');
  localStorage.setItem('sidebar_collapsed', sidebarEl.classList.contains('collapsed'));
});

/* ─── Quick prompts ─── */
document.querySelectorAll('.quick-item').forEach(btn => {
  btn.addEventListener('click', () => {
    inputEl.value = btn.dataset.prompt;
    inputEl.dispatchEvent(new Event('input'));
    inputEl.focus();
    if (window.innerWidth <= 680) sidebarEl.classList.add('collapsed');
  });
});

/* ─── Chat history (IMPROVED) ─── */
function loadChatHistory() {
  const chats = JSON.parse(localStorage.getItem('chat_history') || '[]');
  const list = document.getElementById('recent-chats-list');
  const section = document.getElementById('recent-chats-section');
  list.innerHTML = '';
  if (chats.length === 0) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  chats.forEach(chat => {
    const btn = document.createElement('button');
    btn.className = 'chat-history-item';
    btn.innerHTML = '<i class="ti ti-message"></i>' + escapeHtml(chat.title) +
      '<span class="delete-chat" data-id="' + chat.id + '"><i class="ti ti-x"></i></span>';
    btn.addEventListener('click', (e) => {
      if (e.target.closest('.delete-chat')) return;
      restoreChat(chat.id);
    });
    btn.querySelector('.delete-chat').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    });
    list.appendChild(btn);
  });
}

function saveChatHistory() {
  if (!conversationHistory.length) return;
  let title = 'New chat';
  const firstMsg = conversationHistory.find(m => m.role === 'user');
  if (firstMsg) {
    const t = typeof firstMsg.content === 'string' ? firstMsg.content :
      (Array.isArray(firstMsg.content) ? firstMsg.content.find(b => b.type === 'text')?.text || '' : '');
    title = t.substring(0, 30) + (t.length > 30 ? '...' : '');
  }
  const chats = JSON.parse(localStorage.getItem('chat_history') || '[]');
  if (!currentChatId) {
    currentChatId = Date.now().toString(36);
  }
  const existing = chats.findIndex(c => c.id === currentChatId);
  const entry = { id: currentChatId, title, history: conversationHistory, model: modelSelect.value };
  if (existing >= 0) chats[existing] = entry;
  else chats.unshift(entry);
  if (chats.length > 20) chats.length = 20;
  localStorage.setItem('chat_history', JSON.stringify(chats));
  loadChatHistory();
}

function restoreChat(id) {
  const chats = JSON.parse(localStorage.getItem('chat_history') || '[]');
  const chat = chats.find(c => c.id === id);
  if (!chat) return;
  currentChatId = chat.id;
  conversationHistory = chat.history;
  if (chat.model) modelSelect.value = chat.model;
  messagesEl.innerHTML = '';
  removeAttachment();
  conversationHistory.forEach(msg => {
    if (msg.role === 'user') {
      const html = renderBubbleContent(msg.content);
      addMessage('user', html);
    } else if (msg.role === 'assistant') {
      addMessage('bot', formatResponse(msg.content));
    }
  });
  if (!conversationHistory.length) appendWelcome();
}

function deleteChat(id) {
  let chats = JSON.parse(localStorage.getItem('chat_history') || '[]');
  chats = chats.filter(c => c.id !== id);
  localStorage.setItem('chat_history', JSON.stringify(chats));
  if (currentChatId === id) { currentChatId = null; }
  loadChatHistory();
}

function renderBubbleContent(content) {
  if (typeof content === 'string') return escapeHtml(content);
  if (Array.isArray(content)) {
    return content.map(b => {
      if (b.type === 'image_url') return '<img class="attached-image" src="' + b.image_url.url + '" alt="attached image" />';
      if (b.type === 'text') return escapeHtml(b.text);
      return '';
    }).join('<br>');
  }
  return '';
}

/* ─── File upload handlers ─── */
uploadBtn?.addEventListener('click', () => fileInput?.click());

fileInput?.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    for (const f of fileInput.files) handleFile(f);
    fileInput.value = '';
  }
});

document.addEventListener('paste', (e) => {
  for (const item of e.clipboardData.items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) handleFile(file);
    }
  }
});

/* IMPROVED: Drag and drop */
document.addEventListener('dragenter', (e) => { e.preventDefault(); if (!isLoading) dropOverlay.style.display = 'flex'; });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('dragleave', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest) dropOverlay.style.display = 'none'; });
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.style.display = 'none';
  const files = e.dataTransfer.files;
  for (const f of files) handleFile(f);
});

function handleFile(file) {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const reader = new FileReader();
  reader.onload = (e) => {
    currentAttachments.push({
      name: file.name,
      size: file.size,
      type: isImage ? 'image' : (isPdf ? 'pdf' : 'file'),
      mime: file.type,
      data: e.target.result
    });
    showPreview();
    inputEl.focus();
  };

  if (isImage || isPdf) {
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file);
  }
}

function showPreview() {
  if (!currentAttachments.length) { previewArea.style.display = 'none'; return; }
  previewArea.style.display = 'block';
  previewArea.innerHTML = '';
  currentAttachments.forEach(function(att, i) {
    const size = formatSize(att.size);
    const safeName = escapeHtml(att.name);
    let item;
    if (att.type === 'image') {
      item = document.createElement('div');
      item.className = 'preview-item';
      item.innerHTML =
        '<img class="preview-thumb" src="' + att.data + '" alt="' + safeName + '" onclick="openLightbox(\'' + att.data.replace(/'/g, "\\'") + '\')" />' +
        '<span class="preview-name">' + safeName + '</span>' +
        '<span class="preview-size">' + size + '</span>' +
        '<button class="preview-remove" data-idx="' + i + '"><i class="ti ti-x"></i></button>';
    } else {
      const icon = getFileIcon(att.name);
      item = document.createElement('div');
      item.className = 'preview-item';
      item.innerHTML =
        '<i class="ti ' + icon + ' preview-file-icon"></i>' +
        '<span class="preview-name">' + safeName + '</span>' +
        '<span class="preview-size">' + size + '</span>' +
        '<button class="preview-remove" data-idx="' + i + '"><i class="ti ti-x"></i></button>';
    }
    item.querySelector('.preview-remove').addEventListener('click', function() { removeAttachment(i); });
    previewArea.appendChild(item);
  });
}

window.removeAttachment = function(idx) {
  if (idx !== undefined && idx >= 0 && idx < currentAttachments.length) {
    currentAttachments.splice(idx, 1);
  } else {
    currentAttachments = [];
  }
  if (currentAttachments.length) {
    showPreview();
  } else {
    previewArea.style.display = 'none';
    previewArea.innerHTML = '';
  }
};

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeAttr(str) {
  return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    py: 'ti-brand-python', js: 'ti-brand-javascript', ts: 'ti-brand-typescript',
    java: 'ti-brand-java', sql: 'ti-database', csv: 'ti-table',
    json: 'ti-code', xml: 'ti-code', yaml: 'ti-code', yml: 'ti-code',
    md: 'ti-markdown', html: 'ti-brand-html5', css: 'ti-brand-css3',
    cpp: 'ti-code', go: 'ti-brand-golang', pdf: 'ti-file-text',
    txt: 'ti-file-text', c: 'ti-code', rs: 'ti-brand-rust',
    sh: 'ti-terminal'
  };
  return icons[ext] || 'ti-file';
}

/* ─── New chat / Clear ─── */
function resetChat() {
  conversationHistory = [];
  if (messagesEl) messagesEl.innerHTML = '';
  currentChatId = null;
  lastUserMessage = '';
  lastUserBubbleHtml = '';
  currentAttachments = [];
  if (previewArea) { previewArea.style.display = 'none'; previewArea.innerHTML = ''; }
  appendWelcome();
  if (messagesEl) messagesEl.scrollTop = 0;
}
newChatBtn?.addEventListener('click', resetChat);
clearBtn?.addEventListener('click', resetChat);

/* ─── Character counter (IMPROVED) ─── */
inputEl?.addEventListener('input', () => {
  const len = inputEl.value.length;
  charCounter.textContent = len + ' / 4000';
  charCounter.className = '';
  if (len > 3800) charCounter.classList.add('near-limit');
  if (len > 4000) charCounter.classList.add('over-limit');
  if (len > 4000) inputEl.value = inputEl.value.substring(0, 4000);
  debounceResize();
});

/* IMPROVED: Debounced textarea resize */
let resizeTimeout;
function debounceResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
  }, 50);
}

/* ─── Send on Enter (Shift+Enter = newline) ─── */
inputEl?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
});
sendBtn?.addEventListener('click', () => handleSend());

/* ─── Scroll to bottom (IMPROVED) ─── */
messagesEl?.addEventListener('scroll', () => {
  const dist = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
  scrollBtn.classList.toggle('show', dist > 200);
});
scrollBtn?.addEventListener('click', () => {
  messagesEl.scrollTop = messagesEl.scrollHeight;
  scrollBtn.classList.remove('show');
});

/* ─── Lightbox (IMPROVED) ─── */
window.openLightbox = function(src) {
  lightboxImg.src = src;
  lightbox.style.display = 'flex';
};
window.closeLightbox = function() {
  lightbox.style.display = 'none';
  lightboxImg.src = '';
};

/* ─── Welcome message ─── */
function appendWelcome() {
  if (document.getElementById('welcome-msg')) return;
  const div = document.createElement('div');
  div.className = 'message bot';
  div.id = 'welcome-msg';
  div.innerHTML = `
    <div class="message-avatar avatar-glow">A</div>
    <div class="message-bubble welcome-bubble">
      <div class="welcome-icon">✦</div>
      <p>Hey! I'm <strong>AvinashGPT</strong> — your full-stack AI coding assistant.</p>
      <p class="welcome-sub">I write, debug, and explain code across <strong>all major languages & frameworks</strong>. Pick a quick prompt or type your own below.</p>
      <p class="welcome-sub" style="margin-top:8px;"> New: Attach <strong>multiple files</strong> at once. Enable <strong>Agent Mode</strong> in the sidebar for web search & file tools.</p>
    </div>`;
  messagesEl.appendChild(div);
}

/* ─── Add message bubble ─── */
function addMessage(role, htmlContent) {
  if (!messagesEl) { console.warn('addMessage: messagesEl is null'); return null; }
  const div = document.createElement('div');
  div.className = 'message ' + role;
  const initials = role === 'user' ? 'AK' : 'A';
  div.innerHTML = '<div class="message-avatar">' + initials + '</div><div class="message-bubble">' + htmlContent + '</div>';
  // Delay DOM access so innerHTML renders before any child query
  requestAnimationFrame(() => {
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
  });
  messagesEl.appendChild(div);
  return div;
}

/* ─── Loading skeleton (IMPROVED: replaces dot indicator) ─── */
function showTyping() {
  const div = document.createElement('div');
  div.className = 'message bot'; div.id = 'typing-indicator';
  div.innerHTML = '<div class="message-avatar">A</div><div class="message-bubble">' +
    '<div class="skeleton-loader">' +
      '<div class="skeleton-line"></div>' +
      '<div class="skeleton-line"></div>' +
      '<div class="skeleton-line"></div>' +
    '</div></div>';
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  statusDot.classList.add('loading');
  statusText.textContent = agentMode ? 'Agent is working...' : 'AvinashGPT is thinking...';
}
function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
  statusDot.classList.remove('loading');
  statusText.textContent = 'AvinashGPT is online';
  if (agentMode) agentStatusText.textContent = 'Agent ready';
}

/* ─── Streaming effect (IMPROVED: word-by-word reveal) ─── */
function streamReply(text, msgDiv) {
  return new Promise((resolve) => {
    if (!msgDiv) { resolve(); return; }
    const bubble = msgDiv.querySelector('.message-bubble');
    if (!bubble) { resolve(); return; }
    const words = text.split(' ');
    let idx = 0;
    let displayed = '';
    if (!words.length) { resolve(); return; }
    const interval = setInterval(() => {
      displayed += (idx > 0 ? ' ' : '') + words[idx];
      bubble.innerHTML = formatResponse(displayed) + '<span class="stream-cursor" style="animation:blink 0.6s step-end infinite">▌</span>';
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
      idx++;
      if (idx >= words.length) {
        clearInterval(interval);
        bubble.innerHTML = formatResponse(text);
        resolve();
      }
    }, Math.max(8, Math.min(30, 5000 / words.length)));
  });
}

/* ─── Format markdown-ish response to HTML ─── */
function formatResponse(text) {
  let html = escapeHtml(text);

  // Extract code blocks and replace with placeholders
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const label = lang || 'code';
    const rawCode = code.trim();
    const safeCode = highlightCode(rawCode, lang);
    const id = 'cb-' + Math.random().toString(36).slice(2, 8);
    const l = lang.toLowerCase();
    const supportedLangs = ['python', 'pyspark', 'sql', 'javascript', 'js', 'typescript', 'ts', 'bash', 'sh', 'go', 'golang', 'rust', 'rs'];
    const langCls = supportedLangs.includes(l) ? ' lang-' + l : '';
    const block =
      '<div class="code-wrap' + langCls + '">' +
        '<div class="code-header">' +
          '<span class="code-lang">' + label + '</span>' +
          '<button class="copy-btn" onclick="copyCode(\'' + id + '\')"><i class="ti ti-copy"></i> Copy</button>' +
        '</div>' +
        '<pre id="' + id + '" data-raw="' + escapeAttr(rawCode) + '">' + safeCode + '</pre>' +
      '</div>';
    const idx = codeBlocks.length;
    codeBlocks.push(block);
    return '%%CB' + idx + '%%';
  });

  // Process line by line with if/else priority (each line matches one pattern)
  const lines = html.split('\n');
  html = lines.map(function(line) {
    // Preserve code block placeholders
    var t = line.trim();
    if (/^%%CB\d+%%$/.test(t)) return line;

    // Block-level patterns (mutually exclusive, first match wins)
    if (/^### /.test(line)) {
      return line.replace(/^### (.+)/, '<p style="font-weight:600;font-size:13px;margin:10px 0 4px;color:#a1a1aa;">$1</p>');
    }
    if (/^## /.test(line)) {
      return line.replace(/^## (.+)/, '<p style="font-weight:600;font-size:14px;margin:12px 0 5px;">$1</p>');
    }
    if (/^---$/.test(line)) {
      return '<hr style="border:none;border-top:0.5px solid rgba(255,255,255,0.08);margin:10px 0;">';
    }
    if (/^\d+\.\s/.test(line)) {
      return line.replace(/^(\d+)\.\s(.+)/, '<p style="margin:4px 0;"><strong>$1.</strong> $2</p>');
    }
    if (/💡 Key Takeaway:/.test(line)) {
      var content = line.replace(/^💡 Key Takeaway:\s*/, '');
      content = content.replace(/`([^`\n]+)`/g, function(_, m) { return '<code>' + m + '</code>'; });
      content = content.replace(/\*\*(.+?)\*\*/g, function(_, m) { return '<strong>' + m + '</strong>'; });
      return '<div class="key-takeaway">💡 <strong>Key Takeaway:</strong> ' + content + '</div>';
    }

    // Inline patterns (only for lines not matched by block-level above)
    line = line.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    return line;
  }).join('\n');

  // Restore code blocks
  html = html.replace(/%%CB(\d+)%%/g, function(_, idx) { return codeBlocks[parseInt(idx)] || ''; });

  html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  return html;
}

/* IMPROVED: Copy code uses data-raw */
window.copyCode = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const raw = el.getAttribute('data-raw') || el.innerText;
  navigator.clipboard.writeText(raw).then(() => {
    const btn = el.closest('.code-wrap')?.querySelector('.copy-btn');
    if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> Copied'; setTimeout(() => { btn.innerHTML = '<i class="ti ti-copy"></i> Copy'; }, 2000); }
  });
};

/* ─── Export chat (IMPROVED) ─── */
exportBtn?.addEventListener('click', () => {
  if (!conversationHistory.length) return;
  let md = '# AvinashGPT Chat Export\n\n';
  conversationHistory.forEach(msg => {
    const role = msg.role === 'user' ? '**You**' : '**AvinashGPT**';
    if (typeof msg.content === 'string') {
      md += role + ': ' + msg.content + '\n\n';
    } else if (Array.isArray(msg.content)) {
      const texts = msg.content.map(b => b.type === 'text' ? b.text : '[Image attached]').filter(Boolean);
      md += role + ': ' + texts.join('\n') + '\n\n';
    }
  });
  md += '\n---\n*Exported on ' + new Date().toLocaleString() + '*';
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'AvinashGPT-chat-' + Date.now() + '.md';
  a.click();
  URL.revokeObjectURL(url);
});

/* ─── Syntax highlighting ─── */
function highlightCode(code, lang) {
  const l = (lang || '').toLowerCase();
  if (['python', 'pyspark', 'py'].includes(l)) return highlightPyCharm(code);
  if (l === 'sql') return highlightSSMS(code);
  if (['javascript', 'js', 'typescript', 'ts'].includes(l)) return highlightJSTS(code);
  if (['bash', 'sh'].includes(l)) return highlightBash(code);
  if (['go', 'golang'].includes(l)) return highlightGo(code);
  if (['rust', 'rs'].includes(l)) return highlightRust(code);
  return code;
}

function tokenize(code, patterns) {
  const src = patterns.map(p => '(' + p[0].source + ')').join('|');
  if (!src) return code;
  const allFlags = [...new Set(patterns.flatMap(p => [...p[0].flags]))].join('');
  const re = new RegExp(src, allFlags);
  return code.replace(re, function(...args) {
    for (let i = 0; i < patterns.length; i++) {
      if (args[i + 1] !== undefined) {
        return '<span class="' + patterns[i][1] + '">' + args[i + 1] + '</span>';
      }
    }
    return args[0];
  });
}

function highlightPyCharm(code) {
  return tokenize(code, [
    [/(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"[^"]*"|'(?:(?!')[\s\S])*')/g, 'pyc-string'],
    [/(#.*)$/gm, 'pyc-comment'],
    [/\b\d+\.?\d*\b/g, 'pyc-number'],
    [/\b(from|import|def|class|return|if|else|elif|for|while|try|except|finally|with|as|pass|break|continue|and|or|not|in|is|None|True|False|lambda|yield|raise|self|async|await|print|range|len|type|int|str|list|dict|set|tuple|bool|float|map|filter|zip|enumerate|sorted|open|input|super|global|nonlocal|del|assert|match|case)\b/g, 'pyc-keyword'],
    [/\b\w+(?=\s*\()/g, 'pyc-function'],
  ]);
}

function highlightSSMS(code) {
  return tokenize(code, [
    [/(--.*)$/gm, 'ssms-comment'],
    [/'(?:(?!')[\s\S])*'/g, 'ssms-string'],
    [/\b\d+\.?\d*\b/g, 'ssms-number'],
    [/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|FULL|ON|GROUP|BY|ORDER|HAVING|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|AND|OR|NOT|IN|BETWEEN|LIKE|IS|NULL|AS|DISTINCT|CASE|WHEN|THEN|ELSE|END|UNION|ALL|EXISTS|LIMIT|OFFSET|TOP|DESC|ASC|WITH|RECURSIVE|OVER|PARTITION|ROW_NUMBER|RANK|DENSE_RANK|NTILE|LAG|LEAD|FIRST_VALUE|LAST_VALUE|COALESCE|CAST|CONVERT|IIF|NVL|IFNULL|NULLIF)\b/gi, 'ssms-keyword'],
    [/\b\w+(?=\s*\()/g, 'ssms-function'],
    [/\b\w+\b/g, 'ssms-identifier'],
  ]);
}

/* IMPROVED: JS/TS highlighting */
function highlightJSTS(code) {
  return tokenize(code, [
    [/(?:\/\/.*$|\/\*[\s\S]*?\*\/)/gm, 'jsts-comment'],
    [/(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, 'jsts-string'],
    [/\b\d+\.?\d*\b/g, 'jsts-number'],
    [/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|typeof|instanceof|void|delete|import|export|default|from|as|class|extends|super|async|await|yield|throw|try|catch|finally|in|of|true|false|null|undefined|NaN)\b/g, 'jsts-keyword'],
    [/\b\w+(?=\s*\()/g, 'jsts-function'],
    [/\b(console|Math|JSON|Promise|Array|Object|String|Number|Boolean|Date|RegExp|Map|Set|Symbol|Error|parseInt|parseFloat|isNaN|fetch|localStorage|sessionStorage|document|window)\b/g, 'jsts-builtin'],
  ]);
}

/* IMPROVED: Bash highlighting */
function highlightBash(code) {
  return tokenize(code, [
    [/(#.*)$/gm, 'bash-comment'],
    [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, 'bash-string'],
    [/\b\d+\.?\d*\b/g, 'bash-number'],
    [/\b(if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|local|export|source|\.|exit|break|continue|select|until)\b/g, 'bash-keyword'],
    [/\$\{?\w+\}?/g, 'bash-variable'],
    [/\b(echo|printf|cd|ls|cat|grep|sed|awk|find|xargs|rm|cp|mv|mkdir|chmod|chown|sudo|apt|yum|npm|pip|docker|kubectl|git|curl|wget|sort|uniq|wc|head|tail|tee|cut|tr)\b/g, 'bash-builtin'],
  ]);
}

/* IMPROVED: Go highlighting */
function highlightGo(code) {
  return tokenize(code, [
    [/(?:\/\/.*$|\/\*[\s\S]*?\*\/)/gm, 'go-comment'],
    [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`/g, 'go-string'],
    [/\b\d+\.?\d*\b/g, 'go-number'],
    [/\b(package|import|func|return|if|else|for|range|switch|case|break|continue|go|defer|select|chan|map|struct|interface|type|var|const|fallthrough|default)\b/g, 'go-keyword'],
    [/\b\w+(?=\s*\()/g, 'go-function'],
    [/\b(byte|rune|string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|bool|complex64|complex128|error|nil|true|false|iota|append|copy|close|delete|len|cap|make|new|panic|recover|print|println|fmt|log|http|json|os|io|ioutil|strconv|strings|bytes|time|sync|atomic)\b/g, 'go-builtin'],
    [/\b(bool|byte|complex128|complex64|error|float32|float64|int|int16|int32|int64|int8|rune|string|uint|uint16|uint32|uint64|uint8|uintptr)\b/g, 'go-type'],
  ]);
}

/* IMPROVED: Rust highlighting */
function highlightRust(code) {
  return tokenize(code, [
    [/(?:\/\/.*$|\/\*[\s\S]*?\*\/)/gm, 'rs-comment'],
    [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, 'rs-string'],
    [/\b\d+\.?\d*\b/g, 'rs-number'],
    [/\b(fn|let|mut|const|static|if|else|for|while|loop|match|return|break|continue|impl|trait|struct|enum|pub|use|mod|crate|self|super|where|as|in|ref|move|async|await|unsafe|extern|type|dyn|abstract|override|final|macro_rules)\b/g, 'rs-keyword'],
    [/\b\w+(?=\s*\()/g, 'rs-function'],
    [/\b(i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize|f32|f64|bool|char|str|String|Vec|HashMap|HashSet|Option|Result|Box|Rc|Arc|Cell|RefCell|Mutex|RwLock|Path|PathBuf|OsString|OsStr|CString|CStr|Duration|Instant|SystemTime|true|false|Some|None|Ok|Err|panic|assert|assert_eq|println|eprintln|format|vec|vec!|format!|println!|eprintln!|panic!|unimplemented!|todo!|unreachable!|matches!|include_str!|include_bytes!|stringify!|compile_error!|concat!|env!|option_env!|cfg!|file!|line!|column!)\b/g, 'rs-builtin'],
    [/'\w+/g, 'rs-lifetime'],
    [/\b\w+!/g, 'rs-macro'],
  ]);
}

/* ─── Main send handler (IMPROVED: regenerate, content blocks, rate limit) ─── */
async function handleSend(isRegenerate) {
  const text = inputEl.value.trim();
  if ((!text && !currentAttachments.length && !isRegenerate) || isLoading) return;

  let messageContent;
  let bubbleHtml = '';

  if (isRegenerate) {
    // Reuse stored message; input/attachment already cleared
    messageContent = lastUserMessage;
    bubbleHtml = lastUserBubbleHtml;
    conversationHistory.pop();
    conversationHistory.pop();
    if (messagesEl.children.length >= 2) {
      messagesEl.removeChild(messagesEl.lastChild);
      messagesEl.removeChild(messagesEl.lastChild);
    }
  } else {
    if (currentAttachments.length) {
      const blocks = [];
      var firstImage = true;
      currentAttachments.forEach(function(att) {
        if (att.type === 'image') {
          bubbleHtml += '<img class="attached-image" src="' + att.data + '" alt="' + escapeHtml(att.name) + '" onclick="openLightbox(\'' + att.data.replace(/'/g, "\\'") + '\')" />';
          if (firstImage) { blocks.push({ type: 'text', text: text || 'Analyze this image.' }); firstImage = false; }
          blocks.push({ type: 'image_url', image_url: { url: att.data } });
        } else if (att.type === 'pdf') {
          bubbleHtml += '<div class="attached-file"><i class="ti ' + getFileIcon(att.name) + '"></i><span class="attached-file-name">' + escapeHtml(att.name) + '</span><span class="attached-file-size">' + formatSize(att.size) + '</span></div>';
          blocks.push({ type: 'text', text: '--- Attached file: ' + att.name + ' (base64) ---\n' + att.data + '\n---' });
        } else {
          bubbleHtml += '<div class="attached-file"><i class="ti ' + getFileIcon(att.name) + '"></i><span class="attached-file-name">' + escapeHtml(att.name) + '</span><span class="attached-file-size">' + formatSize(att.size) + '</span></div>';
          blocks.push({ type: 'text', text: '--- File: ' + att.name + ' ---\n' + att.data });
        }
      });
      if (text) blocks.push({ type: 'text', text: text });
      messageContent = blocks;
      bubbleHtml += (text ? '<br><br>' + escapeHtml(text) : '');
    } else {
      messageContent = text;
      bubbleHtml = escapeHtml(text);
    }
    lastUserMessage = messageContent;
    lastUserBubbleHtml = bubbleHtml;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    currentAttachments = [];
    previewArea.style.display = 'none';
    previewArea.innerHTML = '';
  }

  isLoading = true;
  sendBtn.disabled = true;

  addMessage('user', bubbleHtml);
  conversationHistory.push({ role: 'user', content: messageContent });
  showTyping();

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Click the key icon to add one.');
    }

    const s = getSettings();
    const customPrompt = s.customSystemPrompt && s.customSystemPrompt.trim();
    const systemPrompt = agentMode ? AGENT_SYSTEM_PROMPT : (customPrompt || SYSTEM_PROMPT);
    const systemPromptWithMemory = buildSystemPromptWithMemory(systemPrompt);
    const requestMessages = [
      { role: 'system', content: systemPromptWithMemory },
      ...conversationHistory
    ];
    let reply = await callGroq(apiKey, requestMessages);

    // ─── Agent loop: handle tool calls ───
    if (agentMode) {
      let iterations = 0;
      const loopLimit = getSettings().agentLoopLimit || 5;
      while (iterations < loopLimit) {
        const toolCall = parseToolCall(reply);
        if (!toolCall) break;
        iterations++;

        removeTyping();
        const toolResult = await executeTool(toolCall);

        const toolResultMsg = '[Tool: ' + toolResult.tool + ']\nResult: ' + toolResult.result;
        conversationHistory.push({ role: 'assistant', content: reply });
        conversationHistory.push({ role: 'user', content: toolResultMsg });

        showTyping();
        const nextMessages = [
          { role: 'system', content: systemPromptWithMemory },
          ...conversationHistory
        ];
        reply = await callGroq(apiKey, nextMessages);
      }
    }

    conversationHistory.push({ role: 'assistant', content: reply });

    removeTyping();
    const msgDiv = addMessage('bot', '');
    await streamReply(reply, msgDiv);

    const actions = document.createElement('div');
    actions.className = 'bot-actions';
    actions.innerHTML = '<button class="regenerate-btn" onclick="handleSend(true)"><i class="ti ti-refresh"></i> Regenerate</button>';
    const bubbleEl = msgDiv?.querySelector('.message-bubble');
    if (bubbleEl) bubbleEl.appendChild(actions);
    saveChatHistory();
    extractMemories();

  } catch (err) {
    removeTyping();
    if (err.message === 'rate_limit') {
      const msgDiv = addMessage('bot',
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
        '<span>🐢 Slow down! Rate limited. Try in a few seconds.</span>' +
        '<button class="regenerate-btn" onclick="handleSend(true)" style="padding:4px 10px;">' +
        '<i class="ti ti-refresh"></i> Retry</button></div>');
    } else {
      addMessage('bot', '<span style="color:#f87171;">⚠ Error: ' + escapeHtml(err.message) + '.</span>');
    }
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

/* ─── Groq API helper ─── */
async function callGroq(apiKey, messages) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model: modelSelect.value, max_tokens: getSettings().maxTokens || 1500, messages })
  });
  if (response.status === 429) throw new Error('rate_limit');
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || 'HTTP ' + response.status);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response received.';
}

/* ─── Memory: Prompt injection ─── */
function buildSystemPromptWithMemory(basePrompt) {
  const memories = getMemories();
  if (!memories.length) return basePrompt;
  const memBlock = memories.slice(-30).map(m => '- [' + m.category + '] ' + m.content).join('\n');
  return basePrompt + '\n\nWHAT YOU REMEMBER ABOUT THIS USER:\n' + memBlock + '\n\nUse this context naturally. Don\'t repeat it back unless asked.';
}

/* ─── Memory: Auto-extraction ─── */
async function extractMemories() {
  if (conversationHistory.length % 3 !== 0 || !conversationHistory.length) return;
  const apiKey = localStorage.getItem('groq_api_key');
  if (!apiKey) return;
  const chatTitle = (() => {
    const firstMsg = conversationHistory.find(m => m.role === 'user');
    if (!firstMsg) return 'Chat';
    const t = typeof firstMsg.content === 'string' ? firstMsg.content :
      (Array.isArray(firstMsg.content) ? firstMsg.content.find(b => b.type === 'text')?.text || '' : '');
    return t.substring(0, 30) + (t.length > 30 ? '...' : '');
  })();
  const recent = conversationHistory.slice(-6).map(m => m.role + ': ' + (typeof m.content === 'string' ? m.content : '[file/image]')).join('\n');
  const extractPrompt = 'You are a memory extractor. Review this conversation and extract any NEW facts about the user worth remembering long-term.\n\nFocus on:\n- Skills & technologies they use (languages, frameworks, tools, cloud platforms)\n- Preferences (coding style, preferred language, tone they like)\n- Projects they are building\n- Personal info (name, job title, company)\n\nConversation:\n' + recent + '\n\nRespond ONLY with a JSON array. Each item: {"content": "fact here", "category": "skill|preference|project|personal"}\nIf nothing new to remember, respond with exactly: []\nDo not include markdown, no backticks, raw JSON only.';
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 500, messages: [{ role: 'user', content: extractPrompt }] })
    });
    if (!res.ok) return;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '[]';
    const extracted = JSON.parse(text);
    if (Array.isArray(extracted)) extracted.forEach(item => { if (item.content && item.category) addMemory(item.content, item.category, chatTitle); });
  } catch (e) { /* silent */ }
}

/* ─── Memory: UI ─── */
function updateMemoryBadge() {
  const memories = getMemories();
  const badge = document.getElementById('memory-badge');
  const list = document.getElementById('memory-preview-list');
  if (badge) badge.textContent = memories.length;
  if (list) {
    list.innerHTML = memories.slice(-3).reverse().map(m => {
      const icons = { skill: '🛠️', preference: '❤️', project: '📁', personal: '👤' };
      return '<div class="memory-chip">' + (icons[m.category] || '💡') + ' ' + escapeHtml(m.content.substring(0, 40)) + (m.content.length > 40 ? '...' : '') + '</div>';
    }).join('');
  }
}

function renderMemoryList(filter) {
  const container = document.getElementById('memory-list');
  if (!container) return;
  const memories = filter === 'all' ? getMemories() : getMemories().filter(m => m.category === filter);
  if (!memories.length) { container.innerHTML = '<div class="memory-empty">No memories yet. Chat with AvinashGPT to build your memory.</div>'; return; }
  const icons = { skill: '🛠️', preference: '❤️', project: '📁', personal: '👤' };
  const now = Date.now();
  container.innerHTML = memories.slice().reverse().map(m => {
    const days = Math.floor((now - m.timestamp) / 86400000);
    const time = days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
    return '<div class="memory-item" data-category="' + m.category + '">' +
      '<div class="memory-item-icon">' + (icons[m.category] || '💡') + '</div>' +
      '<div class="memory-item-body">' +
        '<div class="memory-item-content">' + escapeHtml(m.content) + '</div>' +
        '<div class="memory-item-meta">' + m.category + ' · from "' + escapeHtml(m.source) + '" · ' + time + '</div>' +
      '</div>' +
      '<button class="memory-item-delete" onclick="deleteMemoryAndRefresh(\'' + m.id + '\')"><i class="ti ti-x"></i></button>' +
    '</div>';
  }).join('');
}

window.deleteMemoryAndRefresh = function(id) { deleteMemory(id); renderMemoryList(document.querySelector('.memory-filter.active')?.dataset?.filter || 'all'); };

window.confirmClearMemories = function() {
  const box = document.getElementById('data-confirm-box');
  document.getElementById('data-confirm-msg').textContent = 'This will permanently delete all saved memories. Are you sure?';
  document.getElementById('data-confirm-yes').onclick = () => {
    clearAllMemories();
    renderMemoryList('all');
    updateMemoryBadge();
    const badge = document.getElementById('memory-count-badge');
    if (badge) badge.textContent = '0';
    box.style.display = 'none';
  };
  box.style.display = 'block';
};

window.activateSettingsTab = function(tabId) {
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.settings-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabId));
};

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Settings modal — setup event listeners
    document.getElementById('settings-btn')?.addEventListener('click', openSettings);
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => activateSettingsTab(tab.dataset.tab));
    });
    document.getElementById('max-tokens-slider')?.addEventListener('input', function() {
      document.getElementById('max-tokens-val').textContent = this.value;
    });
    document.getElementById('agent-loop-slider')?.addEventListener('input', function() {
      document.getElementById('agent-loop-val').textContent = this.value;
    });
    document.getElementById('font-size-slider')?.addEventListener('input', function() {
      document.getElementById('font-size-val').textContent = this.value + 'px';
      const m = document.getElementById('messages');
      if (m) m.style.fontSize = this.value + 'px';
    });
    document.querySelectorAll('.model-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.model-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });
    document.querySelectorAll('.density-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.density-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });
    document.getElementById('custom-system-prompt')?.addEventListener('input', updatePromptCharCount);

    // Memory filter buttons
    document.querySelectorAll('.memory-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.memory-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderMemoryList(btn.dataset.filter);
      });
    });

    updateMemoryBadge();
    appendWelcome();
    loadChatHistory();
    applySettings(getSettings());
  } catch (e) {
    console.error('AvinashGPT init error:', e);
  }
});
