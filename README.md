# AvinashGPT — AI Coding Assistant

A full-stack AI coding assistant powered by Claude (Anthropic). Writes, debugs, and explains code across all major languages and frameworks.

---

## 🚀 Quick Start

### 1. Clone / navigate to the project
```bash
cd /Users/avinashandilya/AvinashGPT
```

### 2. Run locally (no build step needed — pure HTML/CSS/JS)
```bash
# Option A: Python (recommended)
python3 -m http.server 3000

# Option B: Node.js (npx)
npx serve . -p 3000

# Option C: VS Code Live Server
# Right-click index.html → Open with Live Server
```

### 3. Open in browser
```
http://localhost:3000
```

---

## 📁 Project Structure

```
AvinashGPT/
├── index.html          # Main app shell
├── public/
│   ├── style.css       # All styles (dark theme)
│   └── app.js          # Chat logic + Anthropic API calls
└── README.md
```

---

## 🔑 API Key Setup

The app calls the Anthropic API directly from the browser.

> ⚠️ For local/personal use this is fine. For public deployment, move API calls to a backend proxy.

To set your key, open `public/app.js` and the fetch call already uses the standard Anthropic endpoint. The API key is injected via the Claude.ai artifact proxy when running inside Claude — for standalone use, add an `x-api-key` header:

```js
headers: {
  'Content-Type': 'application/json',
  'x-api-key': 'YOUR_ANTHROPIC_API_KEY',
  'anthropic-version': '2023-06-01'
}
```

---

## 🌐 Deploy to GitHub Pages

```bash
# 1. Init git
git init
git add .
git commit -m "feat: initial AvinashGPT release"

# 2. Create repo on GitHub: https://github.com/new
#    Name it: AvinashGPT

# 3. Push
git remote add origin https://github.com/<your-username>/AvinashGPT.git
git branch -M main
git push -u origin main

# 4. Enable GitHub Pages
# GitHub repo → Settings → Pages → Source: main branch → / (root)
# Your app will be live at:
# https://<your-username>.github.io/AvinashGPT
```

---

## ⚡ Features

- 🧠 Powered by Claude Sonnet (Anthropic)
- 🌐 All major languages: Python, JS/TS, Java, C++, Go, Rust, Swift, Kotlin, SQL, PySpark, and more
- 💬 Multi-turn conversation with full context memory
- 📋 Copy-to-clipboard on every code block
- ⌨️ Keyboard shortcut: `Enter` to send, `Shift+Enter` for newline
- 🔄 New Chat / Clear chat button
- 📱 Mobile-responsive sidebar
- 💡 Key Takeaway at the end of complex answers

---

## 🛠 Tech Stack

| Layer      | Tech                        |
|------------|-----------------------------|
| Frontend   | Vanilla HTML, CSS, JS (ES6+)|
| AI Backend | Anthropic Claude API        |
| Icons      | Tabler Icons (webfont CDN)  |
| Fonts      | JetBrains Mono + Inter      |
| Hosting    | GitHub Pages / any static host |

---

## 📜 License

MIT — Built by Avinash Kumar
