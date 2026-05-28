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

/* ─── State ─── */
let conversationHistory = [];
let isLoading = false;
let currentAttachment = null;
let lastUserMessage = ''; // IMPROVED: For regenerate
let lastUserBubbleHtml = ''; // IMPROVED: For regenerate
let currentChatId = null; // IMPROVED: For chat history

/* ─── DOM refs ─── */
const messagesEl  = document.getElementById('messages');
const inputEl     = document.getElementById('user-input');
const sendBtn     = document.getElementById('send-btn');
const clearBtn    = document.getElementById('clear-btn');
const newChatBtn  = document.getElementById('new-chat-btn');
const sidebarEl   = document.getElementById('sidebar');
const toggleBtn   = document.getElementById('sidebar-toggle');
const apiKeyBtn   = document.getElementById('api-key-btn');
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

/* ─── API key management (IMPROVED: modal-based) ─── */
function getApiKey() {
  let key = localStorage.getItem('groq_api_key');
  if (!key) {
    document.getElementById('api-key-modal').style.display = 'flex';
    return null;
  }
  return key;
}

window.saveApiKey = function() {
  const input = document.getElementById('api-key-input');
  const key = input.value.trim();
  if (!key || !key.startsWith('gsk_')) {
    document.getElementById('api-key-error').style.display = 'block';
    return;
  }
  document.getElementById('api-key-error').style.display = 'none';
  localStorage.setItem('groq_api_key', key);
  closeApiKeyModal();
  addMessage('bot', '<span style="color:#86efac;">✓ API key saved.</span>');
};

window.closeApiKeyModal = function() {
  document.getElementById('api-key-modal').style.display = 'none';
};

apiKeyBtn.addEventListener('click', () => {
  const existing = localStorage.getItem('groq_api_key');
  if (existing) {
    document.getElementById('api-key-input').value = existing;
  }
  document.getElementById('api-key-modal').style.display = 'flex';
});

// Check for key on load
window.addEventListener('load', () => {
  if (!localStorage.getItem('groq_api_key')) {
    setTimeout(() => document.getElementById('api-key-modal').style.display = 'flex', 300);
  }
});

/* ─── Theme toggle (IMPROVED) ─── */
function loadTheme() {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') {
    document.body.classList.add('light');
    themeToggle.innerHTML = '<i class="ti ti-moon"></i>';
  } else {
    document.body.classList.remove('light');
    themeToggle.innerHTML = '<i class="ti ti-sun"></i>';
  }
}
loadTheme();

themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  themeToggle.innerHTML = isLight ? '<i class="ti ti-moon"></i>' : '<i class="ti ti-sun"></i>';
});

/* ─── Model selector (IMPROVED) ─── */
function loadModel() {
  const saved = localStorage.getItem('selected_model');
  if (saved) modelSelect.value = saved;
}
loadModel();
modelSelect.addEventListener('change', () => {
  localStorage.setItem('selected_model', modelSelect.value);
});

/* ─── Sidebar toggle (IMPROVED: localStorage) ─── */
function loadSidebarState() {
  const collapsed = localStorage.getItem('sidebar_collapsed');
  if (collapsed === 'true') sidebarEl.classList.add('collapsed');
}
loadSidebarState();

toggleBtn.addEventListener('click', () => {
  sidebarEl.classList.toggle('collapsed');
  localStorage.setItem('sidebar_collapsed', sidebarEl.classList.contains('collapsed'));
});

/* ─── Quick prompts (IMPROVED: breakpoint check) ─── */
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
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    handleFile(fileInput.files[0]);
    fileInput.value = '';
  }
});

document.addEventListener('paste', (e) => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
  if (item) {
    const file = item.getAsFile();
    if (file) handleFile(file);
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
  if (files.length > 0) handleFile(files[0]);
});

function handleFile(file) {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const reader = new FileReader();
  reader.onload = (e) => {
    currentAttachment = {
      name: file.name,
      size: file.size,
      type: isImage ? 'image' : (isPdf ? 'pdf' : 'file'),
      mime: file.type,
      data: e.target.result
    };
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
  if (!currentAttachment) return;
  previewArea.style.display = 'block';

  const size = formatSize(currentAttachment.size);
  const safeName = escapeHtml(currentAttachment.name);

  if (currentAttachment.type === 'image') {
    previewArea.innerHTML =
      '<div class="preview-item">' +
        '<img class="preview-thumb" src="' + currentAttachment.data + '" alt="' + safeName + '" onclick="openLightbox(\'' + currentAttachment.data.replace(/'/g, "\\'") + '\')" />' +
        '<span class="preview-name">' + safeName + '</span>' +
        '<span class="preview-size">' + size + '</span>' +
        '<button class="preview-remove" onclick="removeAttachment()"><i class="ti ti-x"></i></button>' +
      '</div>';
  } else {
    const icon = getFileIcon(currentAttachment.name);
    previewArea.innerHTML =
      '<div class="preview-item">' +
        '<i class="ti ' + icon + ' preview-file-icon"></i>' +
        '<span class="preview-name">' + safeName + '</span>' +
        '<span class="preview-size">' + size + '</span>' +
        '<button class="preview-remove" onclick="removeAttachment()"><i class="ti ti-x"></i></button>' +
      '</div>';
  }
}

window.removeAttachment = function() {
  currentAttachment = null;
  previewArea.style.display = 'none';
  previewArea.innerHTML = '';
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
  messagesEl.innerHTML = '';
  currentChatId = null;
  lastUserMessage = '';
  lastUserBubbleHtml = '';
  removeAttachment();
  appendWelcome();
  messagesEl.scrollTop = 0;
}
newChatBtn.addEventListener('click', resetChat);
clearBtn.addEventListener('click', resetChat);

/* ─── Character counter (IMPROVED) ─── */
inputEl.addEventListener('input', () => {
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
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
});
sendBtn.addEventListener('click', () => handleSend());

/* ─── Scroll to bottom (IMPROVED) ─── */
messagesEl.addEventListener('scroll', () => {
  const dist = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight;
  scrollBtn.classList.toggle('show', dist > 200);
});
scrollBtn.addEventListener('click', () => {
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
  statusDot.classList.add('loading'); // IMPROVED
  statusText.textContent = 'AvinashGPT is thinking...'; // IMPROVED
}
function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
  statusDot.classList.remove('loading'); // IMPROVED
  statusText.textContent = 'AvinashGPT is online'; // IMPROVED
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
exportBtn.addEventListener('click', () => {
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
  if ((!text && !currentAttachment && !isRegenerate) || isLoading) return;

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
    console.log('🔍 currentAttachment:', currentAttachment ? 'SET (' + currentAttachment.type + ', ' + currentAttachment.name + ')' : 'NULL');
    const hasAttachment = !!currentAttachment;
    console.log('🔍 hasAttachment:', hasAttachment, '| text length:', text.length);
    if (hasAttachment) {
      console.log('✅ ENTERED attachment branch, type:', currentAttachment.type);
      const blocks = [];
      if (currentAttachment.type === 'image') {
        bubbleHtml += '<img class="attached-image" src="' + currentAttachment.data + '" alt="' + escapeHtml(currentAttachment.name) + '" onclick="openLightbox(\'' + currentAttachment.data.replace(/'/g, "\\'") + '\')" />';
        blocks.push({ type: 'text', text: text || 'Analyze this image.' });
        blocks.push({ type: 'image_url', image_url: { url: currentAttachment.data } });
      } else if (currentAttachment.type === 'pdf') {
        bubbleHtml += '<div class="attached-file"><i class="ti ' + getFileIcon(currentAttachment.name) + '"></i><span class="attached-file-name">' + escapeHtml(currentAttachment.name) + '</span><span class="attached-file-size">' + formatSize(currentAttachment.size) + '</span></div>';
        blocks.push({ type: 'text', text: '--- Attached file: ' + currentAttachment.name + ' (base64) ---\n' + currentAttachment.data + '\n---' });
        if (text) blocks.push({ type: 'text', text: text });
      } else {
        bubbleHtml += '<div class="attached-file"><i class="ti ' + getFileIcon(currentAttachment.name) + '"></i><span class="attached-file-name">' + escapeHtml(currentAttachment.name) + '</span><span class="attached-file-size">' + formatSize(currentAttachment.size) + '</span></div>';
        blocks.push({ type: 'text', text: '--- File: ' + currentAttachment.name + ' ---\n' + currentAttachment.data });
        if (text) blocks.push({ type: 'text', text: text });
      }
      messageContent = blocks;
      bubbleHtml += (text ? '<br><br>' + escapeHtml(text) : '');
    } else {
      console.log('❌ ELSE branch (no attachment), text:', JSON.stringify(text));
      messageContent = text;
      bubbleHtml = escapeHtml(text);
    }
    lastUserMessage = messageContent;
    lastUserBubbleHtml = bubbleHtml;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    removeAttachment();
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

    const requestMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory
    ];
    console.log('📤 Messages structure:', JSON.stringify(requestMessages.map(m => ({
      role: m.role,
      content_type: Array.isArray(m.content) ? 'array[' + m.content.map(c => c.type).join(',') + ']' : typeof m.content,
      content_len: typeof m.content === 'string' ? m.content.length : (Array.isArray(m.content) ? m.content.length + ' blocks' : '?')
    })), null, 2));
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: modelSelect.value,
        max_tokens: 1500,
        messages: requestMessages
      })
    });

    if (response.status === 429) {
      throw new Error('rate_limit');
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || 'HTTP ' + response.status);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No response received.';
    conversationHistory.push({ role: 'assistant', content: reply });

    removeTyping();
    const msgDiv = addMessage('bot', '');
    await streamReply(reply, msgDiv);

    const actions = document.createElement('div');
    actions.className = 'bot-actions';
    actions.innerHTML = '<button class="regenerate-btn" onclick="handleSend(true)"><i class="ti ti-refresh"></i> Regenerate</button>';
    const bubbleEl = msgDiv?.querySelector('.message-bubble');
    if (bubbleEl) bubbleEl.appendChild(actions);
    // IMPROVED: Save chat history after each exchange
    saveChatHistory();

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

/* ─── Init ─── */
appendWelcome();
loadChatHistory();
