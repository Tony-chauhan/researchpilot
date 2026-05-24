/**
 * searcher.js — Executes search across multiple paper databases
 * Coordinates arXiv and Semantic Scholar searches with rate limiting.
 */

const { searchArxiv, searchSemanticScholar, deduplicatePapers } = require('./tools');

/**
 * Wait for a specified duration (rate limiting)
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute all sub-queries across paper databases
 * @param {Array} subQueries - Array of sub-query objects from planner
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<Object>} Results organized by sub-query
 */
async function searchPapers(subQueries, onProgress) {
  const results = {
    papers: [],
    searchLog: [],
    totalFound: 0
  };

  for (let i = 0; i < subQueries.length; i++) {
    const sq = subQueries[i];

    onProgress && onProgress({
      type: 'search_start',
      message: `Searching for: "${sq.query}" (${sq.aspect})`,
      progress: Math.round(((i) / subQueries.length) * 100)
    });

    // Search arXiv
    try {
      const arxivPapers = await searchArxiv(sq.query, 5);
      results.papers.push(...arxivPapers.map(p => ({ ...p, queryAspect: sq.aspect })));
      results.searchLog.push({
        source: 'arXiv',
        query: sq.query,
        found: arxivPapers.length,
        status: 'success'
      });
      onProgress && onProgress({
        type: 'search_result',
        message: `arXiv: Found ${arxivPapers.length} papers for "${sq.aspect}"`,
      });
    } catch (err) {
      results.searchLog.push({
        source: 'arXiv',
        query: sq.query,
        found: 0,
        status: 'error',
        error: err.message
      });
      onProgress && onProgress({
        type: 'search_warning',
        message: `arXiv search failed for "${sq.aspect}": ${err.message}`,
      });
    }

    // Rate limit: arXiv requires 3s between requests
    await sleep(3200);

    // Search Semantic Scholar
    try {
      const ssPapers = await searchSemanticScholar(sq.query, 5);
      results.papers.push(...ssPapers.map(p => ({ ...p, queryAspect: sq.aspect })));
      results.searchLog.push({
        source: 'Semantic Scholar',
        query: sq.query,
        found: ssPapers.length,
        status: 'success'
      });
      onProgress && onProgress({
        type: 'search_result',
        message: `Semantic Scholar: Found ${ssPapers.length} papers for "${sq.aspect}"`,
      });
    } catch (err) {
      results.searchLog.push({
        source: 'Semantic Scholar',
        query: sq.query,
        found: 0,
        status: 'error',
        error: err.message
      });
    }

    // Rate limit for Semantic Scholar
    await sleep(1500);

    onProgress && onProgress({
      type: 'search_complete',
      message: `Completed search ${i + 1}/${subQueries.length}`,
      progress: Math.round(((i + 1) / subQueries.length) * 100)
    });
  }

  // Deduplicate
  const uniquePapers = deduplicatePapers(results.papers);
  results.totalFound = uniquePapers.length;
  results.papers = uniquePapers;

  onProgress && onProgress({
    type: 'search_done',
    message: `Search complete: ${uniquePapers.length} unique papers found (deduplicated from ${results.papers.length + (results.papers.length - uniquePapers.length)} raw results)`,
    papersFound: uniquePapers.length
  });

  return results;
}

module.exports = { searchPapers };
