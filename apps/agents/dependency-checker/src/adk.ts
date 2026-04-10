import * as GoogleAdk from "@google/adk";

export type AdkAgentHandle = {
  name: string;
  runtime: unknown;
};

export const dependencyCheckerInstruction = [
  "You are the Dependency Checker agent in a CI/CD debate system.",
  "Inspect changed dependencies for vulnerable or risky versions using CVSS and direct-import context.",
  "Respond with concise evidence-backed dependency risk summaries."
].join(" ");

export const createDependencyCheckerAdkAgent = (): AdkAgentHandle => {
  const maybeCtor = (GoogleAdk as Record<string, unknown>).LlmAgent as
    | (new (config: Record<string, unknown>) => unknown)
    | undefined;

  if (!maybeCtor) {
    throw new Error("The installed @google/adk package does not export LlmAgent.");
  }

  const runtime = new maybeCtor({
    name: "dependency_checker",
    description: "Evaluates dependency manifests for vulnerable or risky package changes.",
    model: "groq/llama-3.3-70b-versatile",
    instruction: dependencyCheckerInstruction
  });

  return {
    name: "dependency_checker",
    runtime
  };
};
