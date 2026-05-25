/**
 * orchestrator.js — The main agent loop
 * Coordinates all agent modules: Plan → Search → Extract → Analyze → Synthesize
 * Streams progress events via callbacks for real-time UI updates.
 */

const { planResearch } = require('./planner');
const { searchPapers } = require('./searcher');
const { extractPaperInfo } = require('./extractor');
const { analyzePapers } = require('./analyzer');
const { synthesizeReport } = require('./synthesizer');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Cooldown between Gemini-heavy steps (free tier: 15 RPM)
const GEMINI_COOLDOWN_MS = 500;

/**
 * Run the full autonomous research pipeline
 * @param {string} topic - User's research topic
 * @param {string} apiKey - Gemini API key
 * @param {Function} onEvent - Callback for streaming events to the client
 * @returns {Promise<Object>} Complete research results
 */
async function runResearchAgent(topic, apiKey, onEvent) {
  const startTime = Date.now();

  const emit = (step, type, data) => {
    onEvent && onEvent({
      step,
      type,
      timestamp: Date.now(),
      ...data
    });
  };

  try {
    // ═══════════════════════════════════════════
    // STEP 1: PLANNING
    // ═══════════════════════════════════════════
    emit('planning', 'step_start', {
      message: '🧠 Planning research strategy...',
      detail: `Decomposing "${topic}" into targeted sub-queries`
    });

    const plan = await planResearch(topic, apiKey);

    emit('planning', 'step_complete', {
      message: `✅ Research plan created: ${plan.subQueries.length} sub-queries identified`,
      detail: `Goal: ${plan.researchGoal}`,
      data: {
        subQueries: plan.subQueries.map(sq => ({
          query: sq.query,
          aspect: sq.aspect
        })),
        keyTerms: plan.keyTerms
      }
    });

    // ═══════════════════════════════════════════
    // STEP 2: SEARCHING (no Gemini calls here)
    // ═══════════════════════════════════════════
    emit('searching', 'step_start', {
      message: '🔍 Searching academic databases...',
      detail: `Querying arXiv and Semantic Scholar with ${plan.subQueries.length} queries`
    });

    const searchResults = await searchPapers(plan.subQueries, (progress) => {
      emit('searching', 'step_progress', {
        message: progress.message,
        progress: progress.progress
      });
    });

    emit('searching', 'step_complete', {
      message: `✅ Found ${searchResults.totalFound} unique papers`,
      detail: `Searched across arXiv and Semantic Scholar`,
      data: { totalPapers: searchResults.totalFound }
    });

    // Cooldown before extraction (Gemini-heavy)
    emit('extracting', 'step_start', {
      message: '📖 Preparing to analyze paper contents...',
      detail: `Cooling down before extraction (rate limit protection)`
    });
    await sleep(GEMINI_COOLDOWN_MS);

    // ═══════════════════════════════════════════
    // STEP 3: EXTRACTING
    // ═══════════════════════════════════════════
    emit('extracting', 'step_progress', {
      message: `📖 Analyzing ${searchResults.papers.length} papers...`,
      detail: `Extracting key information from ${searchResults.papers.length} papers`
    });

    const enrichedPapers = await extractPaperInfo(
      searchResults.papers,
      plan.researchGoal,
      apiKey,
      (progress) => {
        emit('extracting', 'step_progress', {
          message: progress.message,
          progress: progress.progress
        });
      }
    );

    emit('extracting', 'step_complete', {
      message: `✅ Extracted insights from ${enrichedPapers.length} relevant papers`,
      detail: `Filtered and ranked by relevance`,
      data: {
        papers: enrichedPapers.slice(0, 10).map(p => ({
          title: p.title,
          authors: p.authors,
          relevance: p.relevanceScore,
          category: p.category,
          url: p.url
        }))
      }
    });

    // Cooldown before analysis
    await sleep(GEMINI_COOLDOWN_MS);

    // ═══════════════════════════════════════════
    // STEP 4: ANALYZING
    // ═══════════════════════════════════════════
    emit('analyzing', 'step_start', {
      message: '🔬 Performing cross-paper analysis...',
      detail: 'Finding consensus, contradictions, and research gaps'
    });

    const analysis = await analyzePapers(enrichedPapers, plan, apiKey, (progress) => {
      emit('analyzing', 'step_progress', {
        message: progress.message
      });
    });

    emit('analyzing', 'step_complete', {
      message: `✅ Analysis complete`,
      detail: `Found ${(analysis.consensusFindings || []).length} consensus points, ${(analysis.researchGaps || []).length} gaps`,
      data: {
        consensusCount: (analysis.consensusFindings || []).length,
        contradictionCount: (analysis.contradictions || []).length,
        gapCount: (analysis.researchGaps || []).length,
        maturity: analysis.overallMaturity
      }
    });

    // Cooldown before synthesis
    await sleep(GEMINI_COOLDOWN_MS);

    // ═══════════════════════════════════════════
    // STEP 5: SYNTHESIZING
    // ═══════════════════════════════════════════
    emit('synthesizing', 'step_start', {
      message: '📝 Generating research report...',
      detail: 'Compiling findings into a comprehensive academic report'
    });

    const report = await synthesizeReport(plan, enrichedPapers, analysis, apiKey, (progress) => {
      emit('synthesizing', 'step_progress', {
        message: progress.message
      });
    });

    emit('synthesizing', 'step_complete', {
      message: '✅ Research report generated!',
      detail: `Report compiled with ${enrichedPapers.length} cited papers`
    });

    // ═══════════════════════════════════════════
    // COMPLETE
    // ═══════════════════════════════════════════
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    emit('complete', 'agent_complete', {
      message: `🎉 Research complete in ${duration}s`,
      detail: `Analyzed ${enrichedPapers.length} papers and generated a comprehensive report`,
      data: {
        report,
        stats: {
          duration: `${duration}s`,
          papersFound: searchResults.totalFound,
          papersAnalyzed: enrichedPapers.length,
          consensusFindings: (analysis.consensusFindings || []).length,
          researchGaps: (analysis.researchGaps || []).length,
          sources: ['arXiv', 'Semantic Scholar']
        }
      }
    });

    return {
      plan,
      papers: enrichedPapers,
      analysis,
      report,
      duration
    };

  } catch (error) {
    emit('error', 'agent_error', {
      message: `❌ Agent error: ${error.message}`,
      detail: error.stack
    });
    throw error;
  }
}

module.exports = { runResearchAgent };
