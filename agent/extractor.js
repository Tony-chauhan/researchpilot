/**
 * extractor.js — Extracts structured information from paper abstracts
 * Uses Gemini to pull out key findings, methodology, and relevance scores.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const EXTRACTION_PROMPT = `You are an expert academic paper analyst. Given a batch of paper abstracts, extract structured information from each.

For each paper, produce a JSON object with:
{
  "title": "paper title",
  "relevanceScore": 0.0-1.0,
  "methodology": "brief description of the method/approach used",
  "keyFindings": ["finding 1", "finding 2"],
  "limitations": "any limitations mentioned or inferred",
  "contribution": "the main contribution in one sentence",
  "category": "one of: foundational, methodology, application, survey, benchmark, theoretical"
}

Return a JSON array of these objects. Only include papers with relevanceScore >= 0.3.
Respond ONLY with valid JSON, no markdown.`;

/**
 * Extract structured info from papers using Gemini
 * @param {Array} papers - Array of paper objects with abstracts
 * @param {string} researchGoal - The original research goal for relevance scoring
 * @param {string} apiKey - Gemini API key
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array>} Enriched paper objects
 */
async function extractPaperInfo(papers, researchGoal, apiKey, onProgress) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  // Process in batches of 5 to stay within context limits
  const batchSize = 5;
  const enrichedPapers = [];

  for (let i = 0; i < papers.length; i += batchSize) {
    const batch = papers.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(papers.length / batchSize);

    onProgress && onProgress({
      type: 'extract_progress',
      message: `Analyzing papers batch ${batchNum}/${totalBatches} (${batch.map(p => p.title.substring(0, 40) + '...').join(', ')})`,
      progress: Math.round((i / papers.length) * 100)
    });

    const paperSummaries = batch.map((p, idx) => (
      `Paper ${idx + 1}:\nTitle: ${p.title}\nAuthors: ${p.authors.join(', ')}\nDate: ${p.published}\nAbstract: ${p.abstract}\n`
    )).join('\n---\n');

    try {
      const result = await model.generateContent([
        { text: EXTRACTION_PROMPT },
        { text: `Research goal: "${researchGoal}"\n\n${paperSummaries}` }
      ]);

      const responseText = result.response.text();
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const extracted = JSON.parse(jsonStr);

      // Merge extracted info back into paper objects
      for (const ext of extracted) {
        const originalPaper = batch.find(
          p => p.title.toLowerCase().includes(ext.title.toLowerCase().substring(0, 30)) ||
               ext.title.toLowerCase().includes(p.title.toLowerCase().substring(0, 30))
        );

        if (originalPaper && ext.relevanceScore >= 0.3) {
          enrichedPapers.push({
            ...originalPaper,
            ...ext,
            title: originalPaper.title // Keep original title
          });
        }
      }
    } catch (err) {
      console.warn(`Extraction batch ${batchNum} failed:`, err.message);
      // Add papers anyway with default extraction
      for (const paper of batch) {
        enrichedPapers.push({
          ...paper,
          relevanceScore: 0.5,
          methodology: 'Unable to extract',
          keyFindings: [paper.abstract.substring(0, 200)],
          limitations: 'Not analyzed',
          contribution: paper.title,
          category: 'unknown'
        });
      }
    }

    // Small delay between batches
    if (i + batchSize < papers.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Sort by relevance
  enrichedPapers.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

  onProgress && onProgress({
    type: 'extract_done',
    message: `Extraction complete: ${enrichedPapers.length} relevant papers analyzed`,
    relevantPapers: enrichedPapers.length
  });

  return enrichedPapers;
}

module.exports = { extractPaperInfo };
