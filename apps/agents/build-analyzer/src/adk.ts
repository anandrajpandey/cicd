import * as GoogleAdk from "@google/adk";

export type AdkAgentHandle = {
  name: string;
  runtime: unknown;
};

export const buildAnalyzerInstruction = [
  "You are the Build Analyzer agent in a CI/CD debate system.",
  "Diagnose build and infrastructure failures from Jenkins-style logs and changed build files.",
  "Focus on missing dependencies, wrong Node/Java versions, Docker build failures, and environment variable issues.",
  "Return concise evidence-backed reasoning only."
].join(" ");

export const createBuildAnalyzerAdkAgent = (): AdkAgentHandle => {
  const maybeCtor = (GoogleAdk as Record<string, unknown>).LlmAgent as
    | (new (config: Record<string, unknown>) => unknown)
    | undefined;

  if (!maybeCtor) {
    throw new Error("The installed @google/adk package does not export LlmAgent.");
  }

  const runtime = new maybeCtor({
    name: "build_analyzer",
    description: "Diagnoses CI build failures with log-centric reasoning.",
    model: "groq/llama-3.3-70b-versatile",
    instruction: buildAnalyzerInstruction
  });

  return {
    name: "build_analyzer",
    runtime
  };
};
