# 🚀 ResearchPilot — Autonomous AI Research Agent

> **AI Hackathon for Builders** by Gradient | May 30-31, 2026

ResearchPilot is a **production-ready, autonomous AI research agent** that searches thousands of academic papers, analyzes findings, and generates comprehensive research reports — all in minutes.

![ResearchPilot](https://img.shields.io/badge/AI-Research%20Agent-blue?style=for-the-badge)
![Gemini](https://img.shields.io/badge/Powered%20by-Gemini%20AI-purple?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Production%20Ready-green?style=for-the-badge)

---

## ✨ What It Does

Enter any research topic and ResearchPilot autonomously:

1. 🧠 **Plans** — Decomposes your topic into targeted sub-queries
2. 🔍 **Searches** — Queries arXiv + Semantic Scholar APIs
3. 📖 **Extracts** — Analyzes paper abstracts for key findings
4. 🔬 **Analyzes** — Cross-references papers to find consensus, contradictions, and gaps
5. 📝 **Synthesizes** — Generates a structured research report with proper citations

**All steps stream in real-time** so you can watch the agent think.

---

## 🏗️ Architecture

```
User Query
    ↓
┌─────────────┐     ┌──────────────────┐
│   Planner   │────▶│  Sub-queries     │
│  (Gemini)   │     │  + Strategy      │
└──────┬──────┘     └──────────────────┘
       ↓
┌─────────────┐     ┌──────────────────┐
│  Searcher   │────▶│  Raw Papers      │
│ (arXiv+S2)  │     │  (Deduplicated)  │
└──────┬──────┘     └──────────────────┘
       ↓
┌─────────────┐     ┌──────────────────┐
│  Extractor  │────▶│  Key Findings    │
│  (Gemini)   │     │  + Relevance     │
└──────┬──────┘     └──────────────────┘
       ↓
┌─────────────┐     ┌──────────────────┐
│  Analyzer   │────▶│  Meta-Analysis   │
│  (Gemini)   │     │  + Gaps          │
└──────┬──────┘     └──────────────────┘
       ↓
┌──────────────┐    ┌──────────────────┐
│ Synthesizer  │───▶│  Final Report    │
│  (Gemini)    │    │  + Citations     │
└──────────────┘    └──────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **LLM** | Google Gemini 2.0 Flash |
| **Paper Search** | arXiv API + Semantic Scholar API |
| **Backend** | Node.js + Express |
| **Frontend** | Vanilla HTML/CSS/JS |
| **Streaming** | Server-Sent Events (SSE) |
| **Design** | Dark glassmorphism with neon accents |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Google AI Studio API key ([get one free](https://aistudio.google.com/apikey))

### Setup

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/researchpilot.git
cd researchpilot

# Install dependencies
npm install

# Add your API key
# Edit the .env file and replace YOUR_GEMINI_API_KEY_HERE with your actual key
echo "GEMINI_API_KEY=your_key_here" > .env

# Start the server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure

```
├── server.js              # Express server + SSE streaming
├── agent/
│   ├── orchestrator.js    # Main agent loop (Plan→Search→Extract→Analyze→Synthesize)
│   ├── planner.js         # Query decomposition using Gemini
│   ├── searcher.js        # arXiv + Semantic Scholar search
│   ├── extractor.js       # Paper info extraction using Gemini
│   ├── analyzer.js        # Cross-paper analysis using Gemini
│   ├── synthesizer.js     # Report generation using Gemini
│   └── tools.js           # API integration utilities
├── public/
│   ├── index.html         # Main application page
│   ├── css/styles.css     # Premium dark mode design system
│   └── js/
│       ├── app.js         # Main app logic + SSE handling
│       ├── agent.js       # Agent workflow visualization
│       ├── markdown.js    # Markdown renderer
│       └── animations.js  # Micro-animations
├── package.json
├── .env                   # API keys (not committed)
└── README.md
```

---

## 🎯 Key Features

- **Fully Autonomous** — No human intervention needed after entering a topic
- **Real-time Streaming** — Watch every step via Server-Sent Events
- **Multi-source Search** — arXiv + Semantic Scholar with deduplication
- **Intelligent Analysis** — Finds consensus, contradictions, and research gaps
- **Academic Reports** — Structured with citations, tables, and proper formatting
- **Premium UI** — Dark glassmorphism design with micro-animations
- **Copy & Download** — Export reports as Markdown
- **Error Resilient** — Graceful degradation with fallback at every step

---

## 📄 License

MIT — Built for the AI Hackathon for Builders by Gradient.
