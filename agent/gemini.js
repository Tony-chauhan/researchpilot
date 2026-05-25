/**
 * gemini.js — Shared Gemini client with retry logic and rate limit handling
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Models to try in order (fallback chain)
const MODELS = ['gemini-2.5-flash-lite'];

/**
 * Sleep for ms duration
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call Gemini with automatic retry, rate-limit backoff, and model fallback
 * @param {string} apiKey - Gemini API key
 * @param {Array} contents - Content array for generateContent
 * @param {Object} options - Optional: { maxRetries, initialDelay }
 * @returns {Promise<string>} Generated text response
 */
async function callGemini(apiKey, contents, options = {}) {
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 1;
  const initialDelay = options.initialDelay || 500;

  const genAI = new GoogleGenerativeAI(apiKey);

  for (let modelIdx = 0; modelIdx < MODELS.length; modelIdx++) {
    const modelName = MODELS[modelIdx];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(contents);
        return result.response.text();
      } catch (error) {
        const errMsg = error.message || '';
        const is429 = errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests');
        const is503 = errMsg.includes('503') || errMsg.includes('overloaded');

        if (is429 || is503) {
          // Extract retry delay from error if available
          const retryMatch = errMsg.match(/retry in (\d+)/i);
          const rawDelay = retryMatch ? (parseInt(retryMatch[1]) + 5) * 1000 : initialDelay * Math.pow(2, attempt);
          const retryDelay = Math.min(rawDelay, 1000); // Cap wait time at 1 second max for fast execution

          console.warn(`[Gemini] Rate limited on ${modelName} (attempt ${attempt + 1}/${maxRetries}). Waiting ${Math.round(retryDelay / 1000)}s...`);

          await sleep(retryDelay);
          continue;
        }

        // Non-retryable error on this model
        console.warn(`[Gemini] Error on ${modelName}: ${errMsg}`);

        if (attempt < maxRetries - 1) {
          await sleep(initialDelay);
          continue;
        }

        // All retries exhausted for this model, try next
        break;
      }
    }

    if (modelIdx < MODELS.length - 1) {
      console.warn(`[Gemini] Falling back from ${modelName} to ${MODELS[modelIdx + 1]}`);
    }
  }

  throw new Error('All Gemini models exhausted after retries. Please check your API key quota at https://ai.google.dev/gemini-api/docs/rate-limits');
}

module.exports = { callGemini, sleep };
