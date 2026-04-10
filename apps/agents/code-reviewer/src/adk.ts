import * as GoogleAdk from "@google/adk";

export type AdkAgentHandle = {
  name: string;
  runtime: unknown;
};

export const codeReviewerInstruction = [
  "You are the Code Reviewer agent in a CI/CD debate system.",
  "Inspect code diffs for security anti-patterns, null dereferences, and suspicious generated-code artifacts.",
  "Prioritize concrete evidence from changed files and keep responses concise."
].join(" ");

export const createCodeReviewerAdkAgent = (): AdkAgentHandle => {
  const maybeCtor = (GoogleAdk as Record<string, unknown>).LlmAgent as
    | (new (config: Record<string, unknown>) => unknown)
    | undefined;

  if (!maybeCtor) {
    throw new Error("The installed @google/adk package does not export LlmAgent.");
  }

  const runtime = new maybeCtor({
    name: "code_reviewer",
    description: "Reviews code diffs for semantic and security regressions.",
    model: "groq/llama-3.3-70b-versatile",
    instruction: codeReviewerInstruction
  });

  return {
    name: "code_reviewer",
    runtime
  };
};
