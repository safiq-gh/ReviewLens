# ReviewLens

> Understand any GitHub Pull Request in 30 seconds.

ReviewLens is a Chrome extension that adds an AI-powered summary panel to every GitHub PR page — what changed, risk areas, and smart review questions. Powered by Groq (fast, free) or Ollama (local, private).

[![ReviewLens Demo](https://img.youtube.com/vi/1vfi2ZdRAmE/maxresdefault.jpg)](https://www.youtube.com/watch?v=1vfi2ZdRAmE)

> Click to watch the full demo

---

## What it does

Open any GitHub PR and click the ReviewLens icon. You get:

- **What Changed** — plain-English summary of the core change and intent
- **Risk Areas** — potential issues grounded in the actual diff (not hallucinated)
- **Questions to Ask** — specific review questions based on what the code actually does

Works from any tab on the PR page. No setup beyond a free Groq API key.

---

## Install

### 1. Get a free Groq API key

Go to [console.groq.com](https://console.groq.com) → sign up free → API Keys → Create key.

Takes 30 seconds. No credit card required.

### 2. Load the extension in Chrome

1. [Download the latest release](https://github.com/safiq-gh/reviewlens/releases)
2. Unzip the file
3. Go to `chrome://extensions`
4. Enable **Developer mode** (top right toggle)
5. Click **Load unpacked**
6. Select the `reviewlens-extension` folder

### 3. Add your Groq key

Click the ReviewLens icon in your toolbar → paste your Groq API key → done.

---

## Usage

1. Open any GitHub Pull Request
2. Click the **ReviewLens** icon in your Chrome toolbar
3. Click **⚡ Summarize PR**

That's it. Works on public and private repos. Works from any PR tab.

### Modes

| Mode | Description |
|------|-------------|
| ⚡ **Groq** | Fast cloud inference via Groq API. Requires a free API key. ~1-2 seconds. |
| 🔒 **Ollama** | Fully local inference. Nothing leaves your machine. Requires [Ollama](https://ollama.com) running locally. |

### Ollama setup (optional, for full privacy)

```bash
# Install Ollama from https://ollama.com
# Then pull a model
ollama pull qwen2.5-coder:1.5b
```

Set `OLLAMA_ORIGINS=*` in your environment variables to allow the extension to connect.

---

## How it works

```
Chrome Extension
      ↓
GitHub API (fetches PR diff invisibly)
      ↓
Groq API or Ollama (local)
      ↓
Structured summary rendered in popup
```

The diff is fetched directly from the GitHub API — no tab switching, no DOM scraping of the diff view. Works from any tab on the PR page.

---

## Models

### Groq (recommended)
| Model | Speed | Quality |
|-------|-------|---------|
| `llama-3.1-8b-instant` | ~1s | Good — default |
| `llama-3.3-70b-versatile` | ~3s | Best |
| `mixtral-8x7b-32768` | ~2s | Balanced |

### Ollama (local)
| Model | Size | Speed |
|-------|------|-------|
| `qwen2.5-coder:1.5b` | 900MB | Fast — recommended |
| `qwen2.5-coder:0.5b` | 400MB | Fastest |
| `qwen2.5-coder:3b` | 1.9GB | Most accurate |

---

## Privacy

- **Groq mode**: PR diff is sent to Groq's API for inference. Groq's [privacy policy](https://groq.com/privacy-policy/) applies. Your Groq API key is stored locally in `chrome.storage.local` and never sent to us.
- **Ollama mode**: Everything runs on your machine. Nothing leaves your browser.
- We have no backend. No analytics. No tracking.

---

## Development

```bash
git clone https://github.com/safiq-gh/reviewlens
cd reviewlens
```

Load the extension from `chrome://extensions` → Load unpacked → select the repo folder.

### File structure

```
reviewlens/
├── manifest.json     # Extension config (Manifest V3)
├── content.js        # Fetches PR data via GitHub API
├── popup.html        # Extension popup UI
├── popup.js          # UI logic, Groq/Ollama API calls
├── icons/            # Extension icons
└── README.md
```

## License

MIT — see [LICENSE](LICENSE)

---

Built by [@safiq-gh](https://github.com/safiq-gh) · [ReviewLens landing page](https://reviewlens-landing.vercel.app)
