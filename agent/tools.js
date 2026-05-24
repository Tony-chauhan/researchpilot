/**
 * tools.js — API integrations for arXiv and Semantic Scholar
 * These are the "hands" of the agent — the tools it uses to interact with the world.
 */

const ARXIV_API = 'http://export.arxiv.org/api/query';
const SEMANTIC_SCHOLAR_API = 'https://api.semanticscholar.org/graph/v1';

/**
 * Search arXiv for papers matching a query
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results (default 10)
 * @returns {Promise<Array>} Array of paper objects
 */
async function searchArxiv(query, maxResults = 10) {
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: '0',
    max_results: String(maxResults),
    sortBy: 'relevance',
    sortOrder: 'descending'
  });

  const url = `${ARXIV_API}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status}`);
  }

  const xmlText = await response.text();
  return parseArxivXml(xmlText);
}

/**
 * Parse arXiv Atom XML response into structured paper objects
 */
function parseArxivXml(xml) {
  const papers = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const getTag = (tag) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
      const m = entry.match(r);
      return m ? m[1].trim() : '';
    };

    const getAttr = (tag, attr) => {
      const r = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"[^>]*/>`);
      const m = entry.match(r);
      return m ? m[1].trim() : '';
    };

    // Extract authors
    const authorRegex = /<author>\s*<name>([\s\S]*?)<\/name>/g;
    const authors = [];
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1].trim());
    }

    // Extract categories
    const categoryRegex = /category\s+term="([^"]+)"/g;
    const categories = [];
    let catMatch;
    while ((catMatch = categoryRegex.exec(entry)) !== null) {
      categories.push(catMatch[1]);
    }

    const id = getTag('id');
    const arxivId = id.replace('http://arxiv.org/abs/', '').replace(/v\d+$/, '');

    papers.push({
      source: 'arxiv',
      id: arxivId,
      title: getTag('title').replace(/\s+/g, ' '),
      authors: authors.slice(0, 5), // Limit to first 5
      abstract: getTag('summary').replace(/\s+/g, ' '),
      published: getTag('published').split('T')[0],
      updated: getTag('updated').split('T')[0],
      categories: categories,
      pdfUrl: getAttr('link', 'title') === 'pdf' ? getAttr('link', 'href') : `https://arxiv.org/pdf/${arxivId}`,
      url: `https://arxiv.org/abs/${arxivId}`
    });
  }

  return papers;
}

/**
 * Search Semantic Scholar for papers
 * @param {string} query - Search query
 * @param {number} limit - Maximum results (default 10)
 * @returns {Promise<Array>} Array of paper objects
 */
async function searchSemanticScholar(query, limit = 10) {
  const params = new URLSearchParams({
    query: query,
    limit: String(limit),
    fields: 'title,abstract,authors,year,citationCount,url,externalIds,publicationDate,fieldsOfStudy'
  });

  const url = `${SEMANTIC_SCHOLAR_API}/paper/search?${params.toString()}`;

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    // Semantic Scholar has rate limits — handle gracefully
    if (response.status === 429) {
      console.warn('Semantic Scholar rate limited, skipping...');
      return [];
    }
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.data) return [];

  return data.data
    .filter(paper => paper.abstract) // Only papers with abstracts
    .map(paper => ({
      source: 'semantic_scholar',
      id: paper.paperId,
      title: paper.title,
      authors: (paper.authors || []).slice(0, 5).map(a => a.name),
      abstract: paper.abstract,
      published: paper.publicationDate || String(paper.year || 'Unknown'),
      year: paper.year,
      citationCount: paper.citationCount || 0,
      fieldsOfStudy: paper.fieldsOfStudy || [],
      url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`
    }));
}

/**
 * Deduplicate papers from multiple sources based on title similarity
 */
function deduplicatePapers(papers) {
  const seen = new Map();

  for (const paper of papers) {
    const normalizedTitle = paper.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(normalizedTitle)) {
      seen.set(normalizedTitle, paper);
    } else {
      // Prefer Semantic Scholar version (has citation counts)
      const existing = seen.get(normalizedTitle);
      if (paper.source === 'semantic_scholar' && existing.source === 'arxiv') {
        seen.set(normalizedTitle, { ...existing, ...paper, source: 'both' });
      }
    }
  }

  return Array.from(seen.values());
}

module.exports = {
  searchArxiv,
  searchSemanticScholar,
  deduplicatePapers
};
