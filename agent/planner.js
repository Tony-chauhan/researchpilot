/**
 * planner.js — Query decomposition & research strategy planning
 * The "brain" that turns a high-level research topic into actionable sub-queries.
 */

const { callGemini } = require('./gemini');

const PLANNING_PROMPT = `You are an expert research strategist. Your job is to decompose a research topic into targeted sub-queries for academic paper search.

Given a research topic, produce a JSON response with this exact structure:
{
  "mainTopic": "the refined main topic",
  "researchGoal": "a one-sentence description of what we want to learn",
  "subQueries": [
    {
      "query": "specific search query for arXiv/Semantic Scholar",
      "aspect": "what aspect this covers (e.g., methodology, applications, limitations)",
      "rationale": "why this sub-query is important"
    }
  ],
  "keyTerms": ["list", "of", "key", "technical", "terms"],
  "timeframe": "suggested time range (e.g., 'last 3 years', 'all time')"
}

Rules:
- Generate 3-5 sub-queries that together cover the topic comprehensively
- Make queries specific enough to find relevant papers, not too broad
- Cover different aspects: foundational work, recent advances, applications, comparisons, limitations
- Use technical terminology appropriate for academic search
- Respond ONLY with valid JSON, no markdown or explanation`;

/**
 * Plan research strategy by decomposing a topic into sub-queries
 * @param {string} topic - The research topic from the user
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Research plan
 */
async function planResearch(topic, apiKey) {
  try {
    const responseText = await callGemini(apiKey, [
      { text: PLANNING_PROMPT },
      { text: `Research topic: "${topic}"` }
    ]);

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const plan = JSON.parse(jsonStr);

    // Validate structure
    if (!plan.subQueries || !Array.isArray(plan.subQueries)) {
      throw new Error('Invalid plan structure');
    }

    return plan;
  } catch (e) {
    // Fallback: generate basic plan
    console.warn('Planner failed, using fallback:', e.message);
    return {
      mainTopic: topic,
      researchGoal: `Comprehensive review of ${topic}`,
      subQueries: [
        { query: topic, aspect: 'general', rationale: 'Main topic search' },
        { query: `${topic} recent advances`, aspect: 'recent', rationale: 'Latest developments' }
      ],
      keyTerms: topic.split(' ').filter(w => w.length > 3),
      timeframe: 'last 3 years'
    };
  }
}

module.exports = { planResearch };
