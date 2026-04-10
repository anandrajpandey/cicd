import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_GROQ_MODEL,
  DEFAULT_OLLAMA_MODEL,
  ProviderError,
  createLlmClient
} from "../dist/index.js";

const messages = [{ role: "user", content: "Why did the build fail?" }];

test("chat returns the Groq response when the primary provider succeeds", async () => {
  const logs = [];
  const client = createLlmClient({
    groqProvider: async () => ({
      text: "Primary answer",
      model: DEFAULT_GROQ_MODEL,
      tokenCount: 123
    }),
    ollamaProvider: async () => {
      throw new Error("Fallback should not be called");
    },
    logger: {
      info: (entry) => {
        logs.push(entry);
      }
    },
    sleep: async () => {}
  });

  const result = await client.chat(messages);

  assert.equal(result, "Primary answer");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].provider, "groq");
  assert.equal(logs[0].model, DEFAULT_GROQ_MODEL);
  assert.equal(logs[0].tokenCount, 123);
});

test("chat falls back to Ollama when Groq returns a 429", async () => {
  const calls = [];
  const client = createLlmClient({
    groqProvider: async () => {
      calls.push("groq");
      throw Object.assign(new Error("rate limited"), { status: 429 });
    },
    ollamaProvider: async () => {
      calls.push("ollama");
      return {
        text: "Fallback answer",
        model: DEFAULT_OLLAMA_MODEL,
        tokenCount: 45
      };
    },
    logger: {
      info: () => {}
    },
    sleep: async () => {}
  });

  const result = await client.chat(messages);

  assert.equal(result, "Fallback answer");
  assert.deepEqual(calls, ["groq", "groq", "groq", "ollama"]);
});

test("chat falls back to Ollama when Groq times out", async () => {
  const client = createLlmClient({
    groqProvider: async () => {
      throw new ProviderError("groq", "groq request timed out after 10000ms");
    },
    ollamaProvider: async () => ({
      text: "Recovered from timeout",
      model: DEFAULT_OLLAMA_MODEL,
      tokenCount: null
    }),
    logger: {
      info: () => {}
    },
    sleep: async () => {}
  });

  const result = await client.chat(messages);

  assert.equal(result, "Recovered from timeout");
});

test("providers retry with exponential backoff before succeeding", async () => {
  const sleepCalls = [];
  let attempts = 0;

  const client = createLlmClient({
    groqProvider: async () => {
      attempts += 1;

      if (attempts < 3) {
        throw new ProviderError("groq", "temporary outage", {
          statusCode: 503,
          retryable: true
        });
      }

      return {
        text: "Succeeded after retries",
        model: DEFAULT_GROQ_MODEL,
        tokenCount: 77
      };
    },
    ollamaProvider: async () => {
      throw new Error("Fallback should not be called");
    },
    logger: {
      info: () => {}
    },
    sleep: async (ms) => {
      sleepCalls.push(ms);
    }
  });

  const result = await client.chat(messages);

  assert.equal(result, "Succeeded after retries");
  assert.equal(attempts, 3);
  assert.deepEqual(sleepCalls, [250, 500]);
});
