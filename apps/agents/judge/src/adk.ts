import * as GoogleAdk from "@google/adk";

export type AdkAgentHandle = {
  name: string;
  runtime: unknown;
};

export const judgeInstruction = [
  "You are the Judge agent in a CI/CD debate system.",
  "Synthesize specialist findings and rebuttals into one weighted risk decision.",
  "Prefer concise, evidence-backed summaries with explicit risk language."
].join(" ");

export const createJudgeAdkAgent = (): AdkAgentHandle => {
  const maybeCtor = (GoogleAdk as Record<string, unknown>).LlmAgent as
    | (new (config: Record<string, unknown>) => unknown)
    | undefined;

  if (!maybeCtor) {
    throw new Error("The installed @google/adk package does not export LlmAgent.");
  }

  const runtime = new maybeCtor({
    name: "judge",
    description: "Synthesizes specialist findings into a single CI/CD decision.",
    model: "groq/llama-3.3-70b-versatile",
    instruction: judgeInstruction
  });

  return {
    name: "judge",
    runtime
  };
};
