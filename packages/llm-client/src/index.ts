import Groq from "groq-sdk";
import { z } from "zod";

export const llmClientPackageName = "llm-client";
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_OLLAMA_MODEL = "mistral:7b";
export const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_TIMEOUT_MS = 10_000;
export const MAX_ATTEMPTS = 3;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type ChatResult = {
  text: string;
  model: string;
  provider: "groq" | "ollama";
  tokenCount: number | null;
};

export type LlmCallLog = {
  provider: "groq" | "ollama";
  model: string;
  latencyMs: number;
  tokenCount: number | null;
  attempt: number;
};

export type Logger = {
  info: (entry: LlmCallLog) => void;
};

type ProviderResponse = {
  text: string;
  model: string;
  tokenCount: number | null;
};

type ProviderCall = (
  messages: ChatMessage[],
  options: Required<ChatOptions>,
  attempt: number
) => Promise<ProviderResponse>;

type LlmClientDependencies = {
  groqProvider?: ProviderCall;
  ollamaProvider?: ProviderCall;
  logger?: Logger;
  sleep?: (ms: number) => Promise<void>;
};

const groqResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional()
        })
      })
    )
    .min(1),
  usage: z
    .object({
      total_tokens: z.number().int().nonnegative().optional()
    })
    .partial()
    .optional()
});

const ollamaResponseSchema = z.object({
  message: z
    .object({
      content: z.string()
    })
    .optional(),
  response: z.string().optional(),
  prompt_eval_count: z.number().int().nonnegative().optional(),
  eval_count: z.number().int().nonnegative().optional()
});

export class ProviderError extends Error {
  readonly provider: "groq" | "ollama";
  readonly statusCode?: number;
  readonly retryable: boolean;

  constructor(
    provider: "groq" | "ollama",
    message: string,
    options?: { statusCode?: number; retryable?: boolean; cause?: unknown }
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? true;

    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

const defaultLogger: Logger = {
  info: (entry) => {
    console.info(JSON.stringify({ level: "info", event: "llm_call", ...entry }));
  }
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeOptions = (options: ChatOptions = {}): Required<ChatOptions> => ({
  temperature: options.temperature ?? 0,
  maxTokens: options.maxTokens ?? 1024,
  timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS
});

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  provider: "groq" | "ollama"
): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(
            new ProviderError(provider, `${provider} request timed out after ${timeoutMs}ms`, {
              retryable: true
            })
          );
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

const getBackoffMs = (attempt: number): number => 250 * 2 ** (attempt - 1);

const getStatusCode = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const maybeStatus = (error as { status?: unknown; statusCode?: unknown }).status;
  if (typeof maybeStatus === "number") {
    return maybeStatus;
  }

  const maybeStatusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof maybeStatusCode === "number" ? maybeStatusCode : undefined;
};

const isGroqFallbackError = (error: unknown): boolean => {
  if (error instanceof ProviderError && error.provider === "groq" && error.message.includes("timed out")) {
    return true;
  }

  const statusCode = getStatusCode(error);
  return statusCode === 429 || statusCode === 503;
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof ProviderError) {
    return error.retryable;
  }

  const statusCode = getStatusCode(error);
  return statusCode === undefined || statusCode >= 500 || statusCode === 429;
};

const createGroqProvider = (): ProviderCall => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required for the Groq client.");
  }

  const client = new Groq({ apiKey });

  return async (messages, options) => {
    const response = await withTimeout(
      client.chat.completions.create({
        model: DEFAULT_GROQ_MODEL,
        messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens
      }),
      options.timeoutMs,
      "groq"
    );

    const parsed = groqResponseSchema.parse(response);
    const text = parsed.choices[0]?.message.content?.trim();

    if (!text) {
      throw new ProviderError("groq", "Groq returned an empty completion.", {
        retryable: false
      });
    }

    return {
      text,
      model: DEFAULT_GROQ_MODEL,
      tokenCount: parsed.usage?.total_tokens ?? null
    };
  };
};

const createOllamaProvider = (): ProviderCall => {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_BASE_URL;
  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/chat`;

  return async (messages, options) => {
    const response = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: DEFAULT_OLLAMA_MODEL,
          stream: false,
          messages,
          options: {
            temperature: options.temperature,
            num_predict: options.maxTokens
          }
        })
      }),
      options.timeoutMs,
      "ollama"
    );

    if (!response.ok) {
      throw new ProviderError("ollama", `Ollama request failed with status ${response.status}.`, {
        statusCode: response.status,
        retryable: response.status >= 500 || response.status === 429
      });
    }

    const body = ollamaResponseSchema.parse(await response.json());
    const text = body.message?.content?.trim() ?? body.response?.trim();

    if (!text) {
      throw new ProviderError("ollama", "Ollama returned an empty completion.", {
        retryable: false
      });
    }

    return {
      text,
      model: DEFAULT_OLLAMA_MODEL,
      tokenCount:
        body.prompt_eval_count !== undefined && body.eval_count !== undefined
          ? body.prompt_eval_count + body.eval_count
          : null
    };
  };
};

const executeWithRetry = async (
  provider: "groq" | "ollama",
  call: ProviderCall,
  messages: ChatMessage[],
  options: Required<ChatOptions>,
  logger: Logger,
  sleepFn: (ms: number) => Promise<void>
): Promise<ChatResult> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();

    try {
      const result = await call(messages, options, attempt);
      logger.info({
        provider,
        model: result.model,
        latencyMs: Date.now() - startedAt,
        tokenCount: result.tokenCount,
        attempt
      });

      return {
        text: result.text,
        model: result.model,
        provider,
        tokenCount: result.tokenCount
      };
    } catch (error) {
      lastError = error;

      if (attempt === MAX_ATTEMPTS || !isRetryableError(error)) {
        break;
      }

      await sleepFn(getBackoffMs(attempt));
    }
  }

  throw lastError;
};

export const createLlmClient = (dependencies: LlmClientDependencies = {}) => {
  const groqProvider = dependencies.groqProvider ?? createGroqProvider();
  const ollamaProvider = dependencies.ollamaProvider ?? createOllamaProvider();
  const logger = dependencies.logger ?? defaultLogger;
  const sleepFn = dependencies.sleep ?? defaultSleep;

  return {
    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
      const normalizedOptions = normalizeOptions(options);

      try {
        const result = await executeWithRetry(
          "groq",
          groqProvider,
          messages,
          normalizedOptions,
          logger,
          sleepFn
        );

        return result.text;
      } catch (error) {
        if (!isGroqFallbackError(error)) {
          throw error;
        }

        const result = await executeWithRetry(
          "ollama",
          ollamaProvider,
          messages,
          normalizedOptions,
          logger,
          sleepFn
        );

        return result.text;
      }
    }
  };
};

let defaultClient: ReturnType<typeof createLlmClient> | undefined;

const getDefaultClient = (): ReturnType<typeof createLlmClient> => {
  if (!defaultClient) {
    defaultClient = createLlmClient();
  }

  return defaultClient;
};

export const chat = (messages: ChatMessage[], options?: ChatOptions): Promise<string> =>
  getDefaultClient().chat(messages, options);
