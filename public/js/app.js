/**
 * app.js — Main application logic
 * Handles form submission, SSE streaming, and report actions
 */

(function () {
  'use strict';

  // ─── DOM Elements ───
  const researchInput = document.getElementById('research-input');
  const researchBtn = document.getElementById('research-btn');
  const workflowSection = document.getElementById('workflow-section');
  const reportSection = document.getElementById('report-section');
  const reportContent = document.getElementById('report-content');
  const copyBtn = document.getElementById('copy-report-btn');
  const downloadBtn = document.getElementById('download-report-btn');
  const liveBadge = document.getElementById('live-badge');
  const suggestionChips = document.querySelectorAll('.suggestion-chip');

  let currentReport = '';
  let isRunning = false;

  // ─── Initialize ───
  function init() {
    AgentUI.init();

    researchBtn.addEventListener('click', startResearch);
    researchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        startResearch();
      }
    });

    // Suggestion chips
    suggestionChips.forEach(chip => {
      chip.addEventListener('click', () => {
        researchInput.value = chip.dataset.query;
        researchInput.focus();
      });
    });

    // Report actions
    if (copyBtn) copyBtn.addEventListener('click', copyReport);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadReport);

    // Check API key status
    checkHealth();
  }

  // ─── Health Check ───
  async function checkHealth() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      if (!data.hasApiKey) {
        Animations.showToast('⚠️ No API key configured. Add your Gemini key to the .env file.', 8000);
      }
    } catch (e) {
      // Server might not be running yet
    }
  }

  // ─── Start Research ───
  function startResearch() {
    const topic = researchInput.value.trim();
    if (!topic || topic.length < 3) {
      Animations.showToast('Please enter a research topic (at least 3 characters).');
      researchInput.focus();
      return;
    }

    if (isRunning) return;

    isRunning = true;
    currentReport = '';

    // Update UI
    researchBtn.disabled = true;
    researchBtn.classList.add('loading');

    // Show workflow section
    workflowSection.style.display = '';
    reportSection.style.display = 'none';
    Animations.fadeIn(workflowSection);

    // Reset agent UI
    AgentUI.init();

    // Show live badge
    if (liveBadge) liveBadge.style.display = '';

    // Scroll to workflow
    setTimeout(() => Animations.scrollTo('workflow-section'), 300);

    // Start SSE connection
    streamResearch(topic);
  }

  // ─── SSE Streaming ───
  function streamResearch(topic) {
    const controller = new AbortController();

    fetch('/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
      signal: controller.signal
    }).then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(err.error || 'Server error');
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            onStreamEnd();
            return;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6));
                handleEvent(event);
              } catch (e) {
                // Skip malformed events
              }
            }
          }

          read();
        }).catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Stream error:', err);
            Animations.showToast(`Connection error: ${err.message}`);
            onStreamEnd();
          }
        });
      }

      read();
    }).catch(err => {
      if (err.name !== 'AbortError') {
        Animations.showToast(`Error: ${err.message}`);
        onStreamEnd();
      }
    });
  }

  // ─── Handle SSE Events ───
  function handleEvent(event) {
    const { step, type, message, detail, data } = event;

    switch (type) {
      case 'connected':
        AgentUI.addThought('🔗 Connected to ResearchPilot agent');
        break;

      case 'step_start':
        AgentUI.activateStep(step);
        AgentUI.addThought(message);
        if (detail) AgentUI.updateStepDetail(step, detail);
        break;

      case 'step_progress':
        AgentUI.addThought(message || detail || '...');
        if (detail) AgentUI.updateStepDetail(step, detail);
        break;

      case 'step_complete':
        AgentUI.completeStep(step);
        AgentUI.addThought(message);
        if (detail) AgentUI.updateStepDetail(step, detail);

        // Render papers when extraction is done
        if (step === 'extracting' && data && data.papers) {
          AgentUI.renderPapers(data.papers);
        }
        break;

      case 'agent_complete':
        AgentUI.completeStep('synthesizing');
        AgentUI.addThought(message);

        if (data) {
          // Render report
          if (data.report) {
            currentReport = data.report;
            showReport(data.report);
          }
          // Render stats
          if (data.stats) {
            AgentUI.renderStats(data.stats);
          }
        }
        break;

      case 'agent_error':
        AgentUI.addThought(`❌ ${message}`);
        Animations.showToast(message, 8000);
        break;

      case 'stream_end':
        onStreamEnd();
        break;

      default:
        if (message) AgentUI.addThought(message);
    }
  }

  // ─── Show Report ───
  function showReport(markdown) {
    reportSection.style.display = '';
    Animations.fadeIn(reportSection);

    // Render markdown to HTML
    const html = MarkdownRenderer.render(markdown);
    reportContent.innerHTML = html;

    // Add "New Research" button at bottom
    const newBtn = document.createElement('button');
    newBtn.className = 'new-research-btn';
    newBtn.innerHTML = '🔄 Start New Research';
    newBtn.addEventListener('click', resetForNewResearch);
    reportContent.appendChild(newBtn);

    // Scroll to report
    setTimeout(() => Animations.scrollTo('report-section'), 500);
  }

  // ─── Stream End ───
  function onStreamEnd() {
    isRunning = false;
    researchBtn.disabled = false;
    researchBtn.classList.remove('loading');

    // Hide live badge
    if (liveBadge) liveBadge.style.display = 'none';
  }

  // ─── Copy Report ───
  function copyReport() {
    if (!currentReport) return;

    navigator.clipboard.writeText(currentReport).then(() => {
      copyBtn.classList.add('copied');
      const span = copyBtn.querySelector('span');
      const originalText = span.textContent;
      span.textContent = 'Copied!';

      setTimeout(() => {
        copyBtn.classList.remove('copied');
        span.textContent = originalText;
      }, 2000);
    }).catch(() => {
      Animations.showToast('Failed to copy. Try selecting the text manually.');
    });
  }

  // ─── Download Report ───
  function downloadReport() {
    if (!currentReport) return;

    const blob = new Blob([currentReport], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'research-report.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Reset for New Research ───
  function resetForNewResearch() {
    researchInput.value = '';
    researchInput.focus();
    workflowSection.style.display = 'none';
    reportSection.style.display = 'none';
    AgentUI.init();
    Animations.scrollTo('hero');
  }

  // ─── Boot ───
  document.addEventListener('DOMContentLoaded', init);
})();
