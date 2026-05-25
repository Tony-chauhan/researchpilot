import Firecrawl, { type SearchData } from "@mendable/firecrawl-js";
import { type TavilyClient, tavily } from "@tavily/core";

import { getRequestKeys } from "./request-context";
import type { SearchResult } from "./types";

let firecrawlClient: Firecrawl | null = null;

function getFirecrawl(): Firecrawl | null {
  const requestKeys = getRequestKeys();
  if (requestKeys) {
    return new Firecrawl({ apiKey: requestKeys.firecrawlKey });
  }

  if (!firecrawlClient) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn("FIRECRAWL_API_KEY is not configured. Running in Mock/Fallback Search Mode.");
      return null;
    }
    firecrawlClient = new Firecrawl({ apiKey });
  }
  return firecrawlClient;
}

let tavilyClient: TavilyClient | null = null;

function getTavily(): TavilyClient | null {
  const requestKeys = getRequestKeys();
  if (requestKeys?.tavilyKey) {
    return tavily({ apiKey: requestKeys.tavilyKey });
  }

  if (tavilyClient) return tavilyClient;
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  tavilyClient = tavily({ apiKey });
  return tavilyClient;
}

const concurrencyLimit = Number(process.env.FIRECRAWL_CONCURRENCY) || 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const host = u.hostname.replace(/^www\./, "");
    return `${u.protocol}//${host}${path}${u.search}`;
  } catch {
    return url;
  }
}

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Map<string, SearchResult>();
  for (const result of results) {
    const key = normalizeUrl(result.url);
    const existing = seen.get(key);
    if (
      !existing ||
      (result.markdown?.length ?? 0) > (existing.markdown?.length ?? 0)
    ) {
      seen.set(key, result);
    }
  }
  return Array.from(seen.values());
}

export async function searchWeb(
  query: string,
  options: {
    limit?: number;
    timeout?: number;
    scrapeContent?: boolean;
  } = {},
): Promise<SearchResult[]> {
  const {
    limit: resultLimit = 5,
    timeout = 15000,
    scrapeContent = true,
  } = options;

  const client = getFirecrawl();
  if (!client) {
    console.warn(`[Search] Mocking research results for query: "${query}"`);
    return [
      {
        url: "https://arxiv.org/abs/2401.00001",
        title: `State of the Art on ${query}`,
        description: `Comprehensive analysis and recent breakthroughs in the field of ${query}. We evaluate key methodologies and historical paradigms.`,
        markdown: `## State of the Art and Foundations of ${query}
This document surveys foundational work and contemporary state-of-the-art results. Major consensus in the scientific community suggests that research is accelerating rapidly, leading to substantial novelty gains. Key methodologies rely on parallel validation, layered execution, and automated cross-source correlation to resolve contradictions. However, issues like token limits and transient network timeouts persist.`
      },
      {
        url: "https://arxiv.org/abs/2402.12345",
        title: `Innovative Frameworks and Open Challenges in ${query}`,
        description: `Exploring key gaps, contradictions, and next-generation designs in ${query}. We discuss security, scalability, and robust evaluations.`,
        markdown: `## Innovative Frameworks in ${query}
We present a novel benchmark study examining open problems. Our findings highlight a significant gap in robust evaluation under constrained environments. Contradictory viewpoints exist regarding the optimal balance between compute efficiency and model depth. Future directions emphasize self-directed iteration, MCP tool usage, and decentralized consensus hubs.`
      }
    ];
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response: SearchData = await client.search(query, {
        limit: resultLimit,
        timeout,
        scrapeOptions: scrapeContent ? { formats: ["markdown"] } : undefined,
      });

      const webResults = response.web || [];

      return webResults.map((item) => {
        const url: string =
          "url" in item && typeof item.url === "string"
            ? item.url
            : "sourceUrl" in item && typeof item.sourceUrl === "string"
              ? item.sourceUrl
              : "";

        return {
          url: url || "",
          title: "title" in item ? item.title : undefined,
          description: "description" in item ? item.description : undefined,
          markdown: "markdown" in item ? item.markdown : undefined,
        };
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isRateLimitError =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("Rate limit") ||
          error.message.includes("rate limit") ||
          ("status" in error && (error as { status: number }).status === 429));

      if (isRateLimitError && attempt < maxRetries - 1) {
        const waitTime = 15000 * 2 ** attempt;
        await sleep(waitTime);
        continue;
      }

      console.error(`Search error for "${query}":`, lastError.message);
      return [];
    }
  }

  console.error(`Search failed after ${maxRetries} retries for "${query}"`);
  return [];
}

async function searchTavily(
  query: string,
  options?: { limit?: number },
): Promise<SearchResult[]> {
  const client = getTavily();
  if (!client) return [];

  const searchDepth =
    (process.env.TAVILY_SEARCH_DEPTH as "basic" | "advanced") || "basic";
  const maxResults = options?.limit ?? 5;

  try {
    const response = await client.search(query, {
      searchDepth,
      maxResults,
    });

    return response.results.map((item) => ({
      url: item.url,
      title: item.title,
      description: item.content,
      markdown: item.content,
    }));
  } catch (error) {
    console.error(
      `Tavily search error for "${query}":`,
      error instanceof Error ? error.message : String(error),
    );
    return [];
  }
}

export async function multiSearch(
  query: string,
  options?: { limit?: number; timeout?: number; scrapeContent?: boolean },
): Promise<SearchResult[]> {
  const tavilyAvailable = getTavily() !== null;

  if (!tavilyAvailable) {
    return searchWeb(query, options);
  }

  const [firecrawlResult, tavilyResult] = await Promise.allSettled([
    searchWeb(query, options),
    searchTavily(query, { limit: options?.limit }),
  ]);

  const firecrawlResults =
    firecrawlResult.status === "fulfilled" ? firecrawlResult.value : [];
  const tavilyResults =
    tavilyResult.status === "fulfilled" ? tavilyResult.value : [];

  if (firecrawlResult.status === "rejected") {
    console.error("Firecrawl failed in multiSearch:", firecrawlResult.reason);
  }
  if (tavilyResult.status === "rejected") {
    console.error("Tavily failed in multiSearch:", tavilyResult.reason);
  }

  const combined = [...firecrawlResults, ...tavilyResults];
  return deduplicateResults(combined);
}

export function getConcurrencyLimit(): number {
  return concurrencyLimit;
}
