/**
 * agent.js — Agent workflow visualization
 * Manages the pipeline step UI, paper cards, and progress indicators
 */

const AgentUI = {
  steps: ['planning', 'searching', 'extracting', 'analyzing', 'synthesizing'],
  currentStep: null,

  /**
   * Initialize the agent UI
   */
  init() {
    this.resetSteps();
  },

  /**
   * Reset all steps to default state
   */
  resetSteps() {
    this.currentStep = null;
    for (const step of this.steps) {
      const el = document.getElementById(`step-${step}`);
      if (!el) continue;
      el.classList.remove('active', 'complete');

      const spinner = el.querySelector('.spinner');
      const check = el.querySelector('.check-icon');
      if (spinner) spinner.style.display = 'none';
      if (check) check.style.display = 'none';

      const detail = document.getElementById(`detail-${step}`);
      if (detail) detail.textContent = 'Waiting...';
    }

    // Clear logs and papers
    const log = document.getElementById('thoughts-log');
    if (log) log.innerHTML = '';

    const papersList = document.getElementById('papers-list');
    if (papersList) papersList.innerHTML = '';

    const papersPanel = document.getElementById('papers-panel');
    if (papersPanel) papersPanel.style.display = 'none';

    const paperCount = document.getElementById('paper-count');
    if (paperCount) paperCount.textContent = '0';
  },

  /**
   * Set a step as active (in progress)
   */
  activateStep(stepName) {
    // Complete previous step if any
    if (this.currentStep && this.currentStep !== stepName) {
      this.completeStep(this.currentStep);
    }

    this.currentStep = stepName;
    const el = document.getElementById(`step-${stepName}`);
    if (!el) return;

    el.classList.add('active');
    el.classList.remove('complete');

    const spinner = el.querySelector('.spinner');
    const check = el.querySelector('.check-icon');
    if (spinner) spinner.style.display = 'block';
    if (check) check.style.display = 'none';

    // Scroll to the pipeline
    Animations.scrollTo('workflow-section');
  },

  /**
   * Mark a step as complete
   */
  completeStep(stepName) {
    const el = document.getElementById(`step-${stepName}`);
    if (!el) return;

    el.classList.remove('active');
    el.classList.add('complete');

    const spinner = el.querySelector('.spinner');
    const check = el.querySelector('.check-icon');
    if (spinner) spinner.style.display = 'none';
    if (check) check.style.display = 'block';

    Animations.pulseGlow(el, 'rgba(16, 185, 129, 0.2)');
  },

  /**
   * Update the detail text for a step
   */
  updateStepDetail(stepName, text) {
    const detail = document.getElementById(`detail-${stepName}`);
    if (detail) {
      detail.textContent = text;
      detail.title = text; // Full text on hover
    }
  },

  /**
   * Add a thought entry to the live log
   */
  addThought(message) {
    const log = document.getElementById('thoughts-log');
    if (!log) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const entry = document.createElement('div');
    entry.className = 'thought-entry';
    entry.innerHTML = `
      <span class="thought-time">${timeStr}</span>
      <span class="thought-message">${this.escapeHtml(message)}</span>
    `;

    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  },

  /**
   * Render paper cards
   */
  renderPapers(papers) {
    const panel = document.getElementById('papers-panel');
    const list = document.getElementById('papers-list');
    const count = document.getElementById('paper-count');

    if (!panel || !list) return;

    panel.style.display = '';
    Animations.fadeIn(panel);

    if (count) count.textContent = papers.length;

    list.innerHTML = '';

    for (const paper of papers) {
      const relevance = paper.relevance || paper.relevanceScore || 0;
      const relevanceClass = relevance >= 0.7 ? 'relevance-high' : relevance >= 0.4 ? 'relevance-medium' : 'relevance-low';
      const relevanceLabel = relevance >= 0.7 ? 'High' : relevance >= 0.4 ? 'Medium' : 'Low';

      const card = document.createElement('div');
      card.className = 'paper-card';
      card.innerHTML = `
        <div class="paper-title">
          ${paper.url ? `<a href="${this.escapeHtml(paper.url)}" target="_blank" rel="noopener">${this.escapeHtml(paper.title)}</a>` : this.escapeHtml(paper.title)}
        </div>
        <div class="paper-meta">
          <span>📅 ${this.escapeHtml(String(paper.published || paper.year || 'N/A').substring(0, 10))}</span>
          <span>👥 ${this.escapeHtml((paper.authors || []).slice(0, 2).join(', '))}${(paper.authors || []).length > 2 ? ' et al.' : ''}</span>
          ${paper.category ? `<span>🏷️ ${this.escapeHtml(paper.category)}</span>` : ''}
          <span class="paper-relevance ${relevanceClass}">${relevanceLabel}</span>
        </div>
      `;

      list.appendChild(card);
    }
  },

  /**
   * Render report stats
   */
  renderStats(stats) {
    const container = document.getElementById('report-stats');
    if (!container) return;

    container.style.display = '';
    container.innerHTML = `
      <div class="stat-item">
        <span class="stat-value" id="stat-duration">${stats.duration || '—'}</span>
        <span class="stat-label">Duration</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="stat-papers">${stats.papersFound || 0}</span>
        <span class="stat-label">Papers Found</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="stat-analyzed">${stats.papersAnalyzed || 0}</span>
        <span class="stat-label">Analyzed</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="stat-findings">${stats.consensusFindings || 0}</span>
        <span class="stat-label">Findings</span>
      </div>
      <div class="stat-item">
        <span class="stat-value" id="stat-gaps">${stats.researchGaps || 0}</span>
        <span class="stat-label">Gaps Found</span>
      </div>
    `;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.AgentUI = AgentUI;
