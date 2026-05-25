import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { getRequestKeys } from "./request-context";
import { Throttle } from "./throttle";

export type ModelTier = "fast" | "smart" | "strategic";
type Provider = "openai" | "groq" | "openrouter" | "google";

const DEFAULT_MODELS: Record<Provider, Record<ModelTier, string>> = {
  openai: {
    fast: "gpt-4.1-mini",
    smart: "gpt-4.1",
    strategic: "o4-mini",
  },
  groq: {
    fast: "meta-llama/llama-4-scout-17b-16e-instruct",
    smart: "meta-llama/llama-4-scout-17b-16e-instruct",
    strategic: "meta-llama/llama-4-scout-17b-16e-instruct",
  },
  openrouter: {
    fast: "google/gemma-3-27b-it:free",
    smart: "meta-llama/llama-3.3-70b-instruct:free",
    strategic: "qwen/qwen3-coder:free",
  },
  google: {
    fast: "gemini-2.5-flash-lite",
    smart: "gemini-2.5-flash-lite",
    strategic: "gemini-2.5-flash-lite",
  },
};

const TIER_ENV_VARS: Record<ModelTier, string> = {
  fast: "AI_MODEL_FAST",
  smart: "AI_MODEL",
  strategic: "AI_MODEL_STRATEGIC",
};

const VALID_PROVIDERS = new Set<string>(["openai", "groq", "openrouter", "google"]);

const API_KEY_CONFIG: Record<
  Provider,
  { env: string; label: string; url: string }
> = {
  openai: {
    env: "OPENAI_API_KEY",
    label: "OPENAI_API_KEY",
    url: "https://platform.openai.com/api-keys",
  },
  groq: {
    env: "GROQ_API_KEY",
    label: "GROQ_API_KEY",
    url: "https://console.groq.com",
  },
  openrouter: {
    env: "OPENROUTER_API_KEY",
    label: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/keys",
  },
  google: {
    env: "GEMINI_API_KEY",
    label: "GEMINI_API_KEY",
    url: "https://aistudio.google.com/apikey",
  },
};

const PROVIDER_FACTORY: Record<
  Provider,
  typeof createOpenAI | typeof createGroq | typeof createOpenRouter | typeof createGoogle
> = {
  openai: createOpenAI,
  groq: createGroq,
  openrouter: createOpenRouter,
  google: createGoogle,
};

const providerCache = new Map<Provider, ReturnType<typeof createOpenAI>>();

function getProviderClient(provider: Provider) {
  const requestKeys = getRequestKeys();
  if (requestKeys) {
    return PROVIDER_FACTORY[provider]({ apiKey: requestKeys.providerKey });
  }

  const cached = providerCache.get(provider);
  if (cached) return cached;

  const { env, label, url } = API_KEY_CONFIG[provider];
  const apiKey = process.env[env];
  if (!apiKey) {
    throw new Error(
      `${label} is required when AI_PROVIDER=${provider}. Get one at ${url}`,
    );
  }

  const client = PROVIDER_FACTORY[provider]({ apiKey });
  providerCache.set(provider, client as ReturnType<typeof createOpenAI>);
  return client;
}

function getProvider(): Provider {
  const requestKeys = getRequestKeys();
  if (requestKeys) return requestKeys.provider;

  const raw = process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? "google" : "openai");
  if (!VALID_PROVIDERS.has(raw)) {
    throw new Error(
      `Invalid AI_PROVIDER "${raw}". Must be one of: openai, groq, openrouter, google`,
    );
  }
  return raw as Provider;
}

function getModelIdForTier(tier: ModelTier, provider: Provider): string {
  const tierModel = process.env[TIER_ENV_VARS[tier]];
  if (tierModel) return tierModel;

  if (tier !== "smart" && process.env.AI_MODEL) {
    return process.env.AI_MODEL;
  }

  return DEFAULT_MODELS[provider][tier];
}

export function getModel(tier?: ModelTier): LanguageModel {
  const provider = getProvider();
  const modelId = getModelIdForTier(tier ?? "smart", provider);
  return getProviderClient(provider)(modelId) as LanguageModel;
}

const freeTierThrottle = new Throttle(
  Number(process.env.LLM_MIN_INTERVAL_MS) || 3000,
);

function isFreeTier(tier: ModelTier): boolean {
  if (getRequestKeys()) return false;
  const provider = getProvider();
  if (provider !== "openrouter") return false;
  return getModelIdForTier(tier, provider).endsWith(":free");
}

export function throttledGenerate<T>(
  tier: ModelTier,
  fn: () => Promise<T>,
): Promise<T> {
  return isFreeTier(tier) ? freeTierThrottle.run(fn) : fn();
}
