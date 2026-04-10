import * as GoogleAdk from "@google/adk";

export type AdkAgentHandle = {
  name: string;
  runtime: unknown;
};

export const testAnalyzerInstruction = [
  "You are the Test Analyzer agent in a CI/CD debate system.",
  "Classify failing tests as flaky, regressions, or new failures using historical failure rates and changed-line coverage.",
  "Use concise evidence-backed summaries."
].join(" ");

export const createTestAnalyzerAdkAgent = (): AdkAgentHandle => {
  const maybeCtor = (GoogleAdk as Record<string, unknown>).LlmAgent as
    | (new (config: Record<string, unknown>) => unknown)
    | undefined;

  if (!maybeCtor) {
    throw new Error("The installed @google/adk package does not export LlmAgent.");
  }

  const runtime = new maybeCtor({
    name: "test_analyzer",
    description: "Classifies failing tests and judges likely flakiness or regressions.",
    model: "groq/llama-3.3-70b-versatile",
    instruction: testAnalyzerInstruction
  });

  return {
    name: "test_analyzer",
    runtime
  };
};
