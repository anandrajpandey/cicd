import { randomUUID } from "node:crypto";

import { chat } from "@packages/llm-client";
import {
  agentFindingSchema,
  type AgentFinding,
  type Challenge,
  type Rebuttal
} from "@packages/shared-types";

import {
  createChallenge,
  createRebuttal,
  type ChallengeRequest,
  type EnrichedPipelineEvent,
  type RebuttalRequest
} from "./schemas.js";

type DetectionType =
  | "missing_dependency"
  | "version_mismatch"
  | "docker_failure"
  | "env_var_error"
  | "unknown_build_failure";

type Detection = {
  type: DetectionType;
  evidence: string[];
  hypothesis: string;
  remediation: string;
  baseConfidence: number;
};

const BUILD_FILE_PATTERN =
  /(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|Dockerfile|docker-compose\.ya?ml|Jenkinsfile|pom\.xml|build\.gradle|gradle\.properties|\.nvmrc|\.tool-versions)$/i;

const dependencyPatterns = [
  /npm ERR!\s+code E404/i,
  /Cannot find module ['"].+['"]/i,
  /No matching version found for /i,
  /error: package .+ could not be resolved/i
];

const versionPatterns = [
  /Unsupported engine/i,
  /Node\.js version .* is not supported/i,
  /JAVA_HOME is not set correctly/i,
  /Source option \d+ is no longer supported/i,
  /requires Java \d+/i
];

const dockerPatterns = [
  /docker build .* returned a non-zero code/i,
  /failed to solve with frontend dockerfile/i,
  /COPY failed/i,
  /executor failed running/i
];

const envVarPatterns = [
  /environment variable .+ is not set/i,
  /Missing required environment variable/i,
  /No credentials specified/i,
  /Access key.*not found/i
];

const normalizeEvidence = (event: EnrichedPipelineEvent): string[] => {
  const jenkinsLines = event.context.jenkinsLogLines ?? [];
  const excerptLines = event.context.rawLogExcerpt ? [event.context.rawLogExcerpt] : [];
  return [...jenkinsLines, ...excerptLines].filter((line) => line.trim().length > 0);
};

const pickEvidence = (lines: string[], patterns: RegExp[]): string[] =>
  lines.filter((line) => patterns.some((pattern) => pattern.test(line))).slice(0, 5);

const detectBuildFailure = (event: EnrichedPipelineEvent): Detection => {
  const lines = normalizeEvidence(event);

  const missingDependencyEvidence = pickEvidence(lines, dependencyPatterns);
  if (missingDependencyEvidence.length > 0) {
    return {
      type: "missing_dependency",
      evidence: missingDependencyEvidence,
      hypothesis: "The build is failing because a required dependency cannot be resolved during the pipeline run.",
      remediation: "Restore the missing dependency or pin the last known good version in the build manifest.",
      baseConfidence: 0.62
    };
  }

  const versionMismatchEvidence = pickEvidence(lines, versionPatterns);
  if (versionMismatchEvidence.length > 0) {
    return {
      type: "version_mismatch",
      evidence: versionMismatchEvidence,
      hypothesis: "The build is failing because the pipeline is using an incompatible Node.js or Java runtime version.",
      remediation: "Align the CI runtime version with the repository's declared toolchain and rebuild.",
      baseConfidence: 0.66
    };
  }

  const dockerFailureEvidence = pickEvidence(lines, dockerPatterns);
  if (dockerFailureEvidence.length > 0) {
    return {
      type: "docker_failure",
      evidence: dockerFailureEvidence,
      hypothesis: "The build is failing inside the Docker build stage due to an invalid container step or missing artifact.",
      remediation: "Inspect the failing Docker layer, fix the referenced instruction, and rerun the image build.",
      baseConfidence: 0.64
    };
  }

  const envVarEvidence = pickEvidence(lines, envVarPatterns);
  if (envVarEvidence.length > 0) {
    return {
      type: "env_var_error",
      evidence: envVarEvidence,
      hypothesis: "The build is failing because a required environment variable or credential is missing from the pipeline environment.",
      remediation: "Restore the missing secret or environment variable in CI and retry the build.",
      baseConfidence: 0.68
    };
  }

  return {
    type: "unknown_build_failure",
    evidence: lines.slice(0, 3),
    hypothesis: "The build failed, but the available log evidence is too weak for a single deterministic root cause.",
    remediation: "Review the final build stage output and rerun the pipeline with more verbose logging enabled.",
    baseConfidence: 0.35
  };
};

export const scoreBuildConfidence = (event: EnrichedPipelineEvent, detection: Detection): number => {
  let score = detection.baseConfidence;

  if ((event.context.recentBuildFailureMatches ?? 0) > 0) {
    score += 0.1;
  }

  if ((event.context.touchedFiles ?? []).some((file) => BUILD_FILE_PATTERN.test(file))) {
    score += 0.15;
  }

  return Math.min(1, Number(score.toFixed(2)));
};

const maybeAskLlmForSummary = async (event: EnrichedPipelineEvent, detection: Detection): Promise<string | null> => {
  const evidence = detection.evidence.join("\n") || "No matching evidence found.";

  try {
    const response = await chat(
      [
        {
          role: "system",
          content:
            "You summarize CI build failures. Answer in one sentence and do not include markdown bullets."
        },
        {
          role: "user",
          content: [
            `Repository: ${event.repository}`,
            `Failure type: ${event.failureType}`,
            `Detected class: ${detection.type}`,
            "Evidence:",
            evidence
          ].join("\n")
        }
      ],
      {
        temperature: 0,
        maxTokens: 120,
        timeoutMs: 4_000
      }
    );

    return response.trim() || null;
  } catch {
    return null;
  }
};

export const analyzeBuildFailure = async (event: EnrichedPipelineEvent): Promise<AgentFinding> => {
  const detection = detectBuildFailure(event);
  const confidence = scoreBuildConfidence(event, detection);
  const llmSummary = await maybeAskLlmForSummary(event, detection);
  const hypothesis = llmSummary ?? detection.hypothesis;

  return agentFindingSchema.parse({
    findingId: randomUUID(),
    agentId: "build_analyzer",
    eventId: event.eventId,
    hypothesis,
    evidence:
      detection.evidence.length > 0
        ? detection.evidence
        : ["No matching build-specific error pattern was found in the supplied context."],
    confidence,
    proposedRemediation: detection.remediation,
    createdAt: new Date()
  });
};

export const issueChallenges = async ({ findings }: ChallengeRequest): Promise<Challenge[]> => {
  const buildFinding = findings.find((finding) => finding.agentId === "build_analyzer");

  if (!buildFinding) {
    return [];
  }

  return findings
    .filter((finding) => finding.agentId !== "build_analyzer")
    .filter((finding) => buildFinding.confidence >= finding.confidence)
    .filter((finding) => buildFinding.evidence.length > 0)
    .map((finding) =>
      createChallenge({
        challengerAgentId: "build_analyzer",
        targetAgentId: finding.agentId,
        counterHypothesis: `The pipeline evidence more strongly supports a build-system failure than ${finding.agentId}'s hypothesis.`,
        evidence: buildFinding.evidence.slice(0, 2),
        confidence: Math.min(1, Number((buildFinding.confidence - finding.confidence + 0.55).toFixed(2)))
      })
    );
};

export const createBuildRebuttal = async ({
  challenge,
  currentFinding
}: RebuttalRequest): Promise<Rebuttal> => {
  const mentionsBuild = /build|dependency|docker|node|java|env/i.test(challenge.counterHypothesis);
  const position = mentionsBuild && currentFinding ? "DEFEND" : "CONCEDE";
  const rebuttalFactor = position === "DEFEND" ? 0.85 : 0.7;
  const baseConfidence = currentFinding?.confidence ?? 0.4;
  const updatedConfidence =
    position === "DEFEND"
      ? Math.max(0, Number((baseConfidence * 0.97).toFixed(2)))
      : Math.max(0, Number((baseConfidence * 0.82).toFixed(2)));

  return createRebuttal({
    respondingAgentId: "build_analyzer",
    challengeId: challenge.challengeId,
    position,
    updatedConfidence,
    rebuttalFactor
  });
};
