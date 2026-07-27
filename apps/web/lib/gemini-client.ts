/**
 * Compatibilidade: reexporta o cliente Claude (`llm-client`) com os nomes Gemini antigos.
 * Novos ficheiros devem importar de `@/lib/llm-client`.
 */

export {
  DEFAULT_LLM_MODEL as DEFAULT_GEMINI_MODEL,
  LLM_FALLBACK_MODELS as GEMINI_FALLBACK_MODELS,
  DEFAULT_LLM_MAX_OUTPUT as DEFAULT_GEMINI_MAX_OUTPUT,
  getLlmModelCandidates as getGeminiModelCandidates,
  getLlmApiKey as getGeminiApiKey,
  getLlmModel as getGeminiModel,
  getLlmMaxOutputTokens as getGeminiMaxOutputTokens,
  llmGenerateContent as geminiGenerateContent,
  llmCompleteText as geminiCompleteText,
  llmCompleteJsonText as geminiCompleteJsonText,
  llmCompleteWithWebSearch as geminiCompleteWithWebSearch,
  llmCompleteVision as geminiCompleteVision,
  llmCompleteJsonWithPdf as geminiCompleteJsonWithPdf,
  llmStreamAsOpenAICompatibleSSE as geminiStreamAsOpenAICompatibleSSE,
  imageMimeFromFilename,
  type LlmPart as GeminiPart,
  type LlmGenerateOptions as GeminiGenerateOptions,
  type LlmGenerateResult as GeminiGenerateResult,
} from '@/lib/llm-client';
