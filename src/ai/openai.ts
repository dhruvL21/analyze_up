import OpenAI from 'openai';

/**
 * Centralized Model Architecture
 */
export const AI_MODELS = {
  // Frontier Model: Used for Deep Demand Forecasting, Macro What-If Simulations & Negotiation
  FRONTIER: process.env.OPENAI_FRONTIER_MODEL || 'gpt-5',
  
  // Flagship Model: Used for Market Analysis, Copilot Chatbot, Today's AI Brief, Column Mapping & AI Actions
  FLAGSHIP: process.env.OPENAI_FLAGSHIP_MODEL || 'gpt-4o',
  
  // Lightweight Model: Used for fast utility copywriting
  MINI: process.env.OPENAI_MINI_MODEL || 'gpt-4o-mini',
  
  // Embeddings
  EMBEDDING: 'text-embedding-3-small',
} as const;

/**
 * Retrieves the configured OpenAI API key from environment variables.
 */
export function getOpenAIApiKey(): string {
  return process.env.OPENAI_API_KEY || '';
}

/**
 * Checks whether the OpenAI API key is defined in the environment.
 */
export function isOpenAIConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(
    key &&
    key.trim().length > 10 &&
    !key.startsWith('missing-') &&
    !key.startsWith('sk-placeholder') &&
    !key.includes('your-api-key')
  );
}

/**
 * Singleton OpenAI client instance initialized safely.
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'missing-openai-api-key',
  maxRetries: 2,
  timeout: 25000,
  dangerouslyAllowBrowser: true,
});

/**
 * Resilient helper to execute chat completions with automatic fallback
 * (e.g. if gpt-5 is requested but not yet enabled for the key, seamlessly falls back to gpt-4o).
 */
export async function createChatCompletionWithFallback(
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming
): Promise<OpenAI.Chat.ChatCompletion> {
  try {
    return await openai.chat.completions.create(params);
  } catch (error: any) {
    if (params.model === AI_MODELS.FRONTIER && params.model !== AI_MODELS.FLAGSHIP) {
      console.warn(`[AI Engine] ${params.model} invocation failed or not permitted, falling back to ${AI_MODELS.FLAGSHIP}.`);
      return await openai.chat.completions.create({
        ...params,
        model: AI_MODELS.FLAGSHIP,
      });
    }
    throw error;
  }
}
