/**
 * analyzer.js — Cross-paper analysis, consensus detection, and gap identification
 * The "critic" that finds patterns across multiple papers.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

const ANALYSIS_PROMPT = `You are a senior research scientist performing a meta-analysis of academic papers. Analyze the following set of papers and produce a comprehensive cross-paper analysis.

Return a JSON object with this structure:
{
  "consensusFindings": [
    {
      "finding": "description of agreed-upon finding",
      "supportingPapers": ["paper title 1", "paper title 2"],
      "confidence": "high/medium/low"
    }
  ],
  "contradictions": [
    {
      "topic": "the disputed topic",
      "positions": [
        { "view": "position A", "papers": ["paper 1"] },
        { "view": "position B", "papers": ["paper 2"] }
      ]
    }
  ],
  "researchGaps": [
    {
      "gap": "description of under-explored area",
      "importance": "high/medium/low",
      "suggestedDirection": "how future work could address this"
    }
  ],
  "methodologyTrends": [
    {
      "trend": "description of methodological trend",
      "adoption": "widespread/growing/emerging/declining"
    }
  ],
  "temporalEvolution": "A 2-3 sentence description of how the field has evolved over the papers' publication dates",
  "overallMaturity": "nascent/growing/established/mature — assessment of the field's maturity"
}

Be specific and cite paper titles. Respond ONLY with valid JSON.`;

/**
 * Perform cross-paper analysis
 * @param {Array} papers - Enriched paper objects from extractor
 * @param {Object} plan - Research plan from planner
 * @param {string} apiKey - Gemini API key
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Analysis results
 */
async function analyzePapers(papers, plan, apiKey, onProgress) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  onProgress && onProgress({
    type: 'analyze_start',
    message: `Performing cross-paper analysis on ${papers.length} papers...`
  });

  // Prepare paper summaries for analysis
  const paperSummaries = papers.slice(0, 20).map((p, idx) => (
    `Paper ${idx + 1}: "${p.title}"
Authors: ${p.authors.join(', ')}
Date: ${p.published}
Category: ${p.category || 'unknown'}
Methodology: ${p.methodology || 'N/A'}
Key Findings: ${(p.keyFindings || []).join('; ')}
Limitations: ${p.limitations || 'N/A'}
Contribution: ${p.contribution || 'N/A'}
Relevance Score: ${p.relevanceScore || 'N/A'}`
  )).join('\n\n---\n\n');

  try {
    const result = await model.generateContent([
      { text: ANALYSIS_PROMPT },
      { text: `Research Goal: "${plan.researchGoal}"\nMain Topic: "${plan.mainTopic}"\n\nPapers to analyze:\n\n${paperSummaries}` }
    ]);

    const responseText = result.response.text();
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const analysis = JSON.parse(jsonStr);

    onProgress && onProgress({
      type: 'analyze_done',
      message: `Analysis complete: ${(analysis.consensusFindings || []).length} consensus findings, ${(analysis.contradictions || []).length} contradictions, ${(analysis.researchGaps || []).length} research gaps identified`
    });

    return analysis;
  } catch (err) {
    console.warn('Analysis failed:', err.message);
    onProgress && onProgress({
      type: 'analyze_warning',
      message: `Analysis partially failed: ${err.message}. Generating basic analysis...`
    });

    // Return a basic analysis
    return {
      consensusFindings: [{
        finding: 'Analysis could not be fully completed. Papers cover the topic from multiple angles.',
        supportingPapers: papers.slice(0, 3).map(p => p.title),
        confidence: 'low'
      }],
      contradictions: [],
      researchGaps: [{
        gap: 'Further investigation needed to identify specific gaps',
        importance: 'medium',
        suggestedDirection: 'Deeper review with full-text access recommended'
      }],
      methodologyTrends: [],
      temporalEvolution: 'Unable to determine temporal evolution with current analysis.',
      overallMaturity: 'growing'
    };
  }
}

module.exports = { analyzePapers };
