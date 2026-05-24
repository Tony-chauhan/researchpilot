/**
 * synthesizer.js — Generates the final structured research report
 * Compiles all findings into a polished, cited academic report.
 */

const { callGemini } = require('./gemini');

const SYNTHESIS_PROMPT = `You are a world-class academic writer. Generate a comprehensive, well-structured research report based on the analysis provided.

The report MUST follow this exact markdown structure:

# Research Report: [Topic]

## Executive Summary
A 3-4 paragraph overview of the entire research landscape. What is the field about? What are the key takeaways? What is the current state of the art?

## Methodology
How this research was conducted: number of papers analyzed, sources queried, time period covered.

## Key Findings

### Consensus in the Field
Summarize what researchers agree on. Use bullet points with citations like [Author et al., Year].

### Emerging Trends
What new methodologies or approaches are gaining traction?

### Notable Contradictions
Where do researchers disagree? What are the competing viewpoints?

## Detailed Paper Analysis

For the top 5-8 most relevant papers, provide a brief analysis:

### [Paper Title] (Year)
- **Authors:** ...
- **Methodology:** ...
- **Key Contribution:** ...
- **Relevance:** High/Medium

## Research Gaps & Future Directions
What remains unexplored? What are the most promising directions?

## Conclusion
A concise summary of the overall findings and their implications.

## References
List all papers cited in the report in academic format.

---

Important rules:
- Write in formal academic style but keep it readable
- Include specific details from the papers, not generic statements
- Every claim should reference at least one paper
- Use markdown formatting: headers, bold, bullet points, tables where appropriate
- The report should be 1500-2500 words
- Make it genuinely useful to a researcher entering this field`;

/**
 * Generate the final research report
 * @param {Object} plan - Research plan
 * @param {Array} papers - Enriched papers
 * @param {Object} analysis - Cross-paper analysis
 * @param {string} apiKey - Gemini API key
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<string>} Markdown report
 */
async function synthesizeReport(plan, papers, analysis, apiKey, onProgress) {
  onProgress && onProgress({
    type: 'synthesize_start',
    message: 'Generating comprehensive research report...'
  });

  // Build context for the synthesizer
  const context = buildReportContext(plan, papers, analysis);

  try {
    let report = await callGemini(apiKey, [
      { text: SYNTHESIS_PROMPT },
      { text: context }
    ]);

    // Clean up any code block wrappers
    report = report.replace(/^```(?:markdown)?\s*/m, '').replace(/\s*```$/m, '');

    onProgress && onProgress({
      type: 'synthesize_done',
      message: 'Research report generated successfully!'
    });

    return report;
  } catch (err) {
    console.error('Synthesis failed:', err.message);
    onProgress && onProgress({
      type: 'synthesize_warning',
      message: `Report generation encountered issues: ${err.message}. Generating fallback report...`
    });

    return generateFallbackReport(plan, papers, analysis);
  }
}

/**
 * Build the context string for the report synthesizer
 */
function buildReportContext(plan, papers, analysis) {
  const topPapers = papers.slice(0, 15);

  let context = `RESEARCH TOPIC: ${plan.mainTopic}\n`;
  context += `RESEARCH GOAL: ${plan.researchGoal}\n`;
  context += `TOTAL PAPERS ANALYZED: ${papers.length}\n`;
  context += `KEY TERMS: ${(plan.keyTerms || []).join(', ')}\n\n`;

  context += `=== CROSS-PAPER ANALYSIS ===\n`;

  if (analysis.consensusFindings) {
    context += `\nCONSENSUS FINDINGS:\n`;
    for (const cf of analysis.consensusFindings) {
      context += `- ${cf.finding} (Confidence: ${cf.confidence}, Supported by: ${(cf.supportingPapers || []).join('; ')})\n`;
    }
  }

  if (analysis.contradictions && analysis.contradictions.length > 0) {
    context += `\nCONTRADICTIONS:\n`;
    for (const c of analysis.contradictions) {
      context += `- Topic: ${c.topic}\n`;
      for (const pos of (c.positions || [])) {
        context += `  - ${pos.view} (Papers: ${(pos.papers || []).join('; ')})\n`;
      }
    }
  }

  if (analysis.researchGaps) {
    context += `\nRESEARCH GAPS:\n`;
    for (const gap of analysis.researchGaps) {
      context += `- ${gap.gap} (Importance: ${gap.importance}) → ${gap.suggestedDirection}\n`;
    }
  }

  if (analysis.methodologyTrends) {
    context += `\nMETHODOLOGY TRENDS:\n`;
    for (const trend of analysis.methodologyTrends) {
      context += `- ${trend.trend} (${trend.adoption})\n`;
    }
  }

  context += `\nTEMPORAL EVOLUTION: ${analysis.temporalEvolution || 'N/A'}\n`;
  context += `FIELD MATURITY: ${analysis.overallMaturity || 'N/A'}\n\n`;

  context += `=== PAPER DETAILS ===\n\n`;
  for (const p of topPapers) {
    context += `TITLE: ${p.title}\n`;
    context += `AUTHORS: ${(p.authors || []).join(', ')}\n`;
    context += `DATE: ${p.published}\n`;
    context += `URL: ${p.url || 'N/A'}\n`;
    context += `METHODOLOGY: ${p.methodology || 'N/A'}\n`;
    context += `KEY FINDINGS: ${(p.keyFindings || []).join('; ')}\n`;
    context += `CONTRIBUTION: ${p.contribution || 'N/A'}\n`;
    context += `LIMITATIONS: ${p.limitations || 'N/A'}\n`;
    context += `RELEVANCE: ${p.relevanceScore || 'N/A'}\n`;
    context += `CITATIONS: ${p.citationCount || 'N/A'}\n\n`;
  }

  return context;
}

/**
 * Generate a basic report when the LLM synthesis fails
 */
function generateFallbackReport(plan, papers, analysis) {
  const topPapers = papers.slice(0, 8);

  let report = `# Research Report: ${plan.mainTopic}\n\n`;
  report += `## Executive Summary\n\n`;
  report += `This report presents findings from an automated literature review on "${plan.mainTopic}". `;
  report += `A total of ${papers.length} papers were analyzed from arXiv and Semantic Scholar.\n\n`;

  report += `## Papers Analyzed\n\n`;
  for (const p of topPapers) {
    report += `### ${p.title}\n`;
    report += `- **Authors:** ${(p.authors || []).join(', ')}\n`;
    report += `- **Date:** ${p.published}\n`;
    report += `- **Key Findings:** ${(p.keyFindings || ['See abstract']).join('; ')}\n`;
    if (p.url) report += `- **Link:** [View Paper](${p.url})\n`;
    report += `\n`;
  }

  if (analysis.researchGaps && analysis.researchGaps.length > 0) {
    report += `## Research Gaps\n\n`;
    for (const gap of analysis.researchGaps) {
      report += `- **${gap.gap}** (Importance: ${gap.importance})\n`;
    }
  }

  report += `\n## References\n\n`;
  for (let i = 0; i < topPapers.length; i++) {
    const p = topPapers[i];
    report += `${i + 1}. ${(p.authors || []).slice(0, 3).join(', ')}${p.authors?.length > 3 ? ' et al.' : ''}. "${p.title}" (${p.published}). ${p.url || ''}\n`;
  }

  return report;
}

module.exports = { synthesizeReport };
