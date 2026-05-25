/**
 * server.js — Express server with SSE streaming for the research agent
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { runResearchAgent } = require('./agent/orchestrator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE'
  });
});

/**
 * SSE endpoint — streams agent progress in real-time
 * POST /api/research
 * Body: { topic: string }
 */
app.post('/api/research', async (req, res) => {
  const { topic } = req.body;

  if (!topic || topic.trim().length < 3) {
    return res.status(400).json({ error: 'Please provide a research topic (at least 3 characters).' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    return res.status(500).json({ error: 'Gemini API key not configured. Please add your key to the .env file.' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Transfer-Encoding': 'chunked',
    'Content-Encoding': 'none'
  });
  res.flushHeaders();

  // Track if connection is still alive
  let isAlive = true;
  req.on('close', () => {
    isAlive = false;
  });

  // Helper: write SSE event and flush
  const sendEvent = (data) => {
    if (isAlive) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    }
  };

  // Send initial connection event
  sendEvent({ step: 'connected', type: 'connected', message: 'Connected to ResearchPilot agent' });

  try {
    await runResearchAgent(topic, apiKey, (event) => {
      sendEvent(event);
    });
  } catch (error) {
    if (isAlive) {
      res.write(`data: ${JSON.stringify({
        step: 'error',
        type: 'agent_error',
        message: `Agent error: ${error.message}`,
        detail: error.message
      })}\n\n`);
    }
  }

  if (isAlive) {
    res.write(`data: ${JSON.stringify({ step: 'done', type: 'stream_end' })}\n\n`);
    res.end();
  }
});

// Serve index.html for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  ✨ ResearchPilot is running at http://localhost:${PORT}\n`);
  const hasKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE';
  if (!hasKey) {
    console.log('  ⚠️  No Gemini API key found. Add your key to .env file.');
    console.log('  📝  Get a free key at: https://aistudio.google.com/apikey\n');
  } else {
    console.log('  ✅ Gemini API key configured.\n');
  }
});
