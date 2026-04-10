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
  | "critical_vulnerability"
  | "vulnerable_dependency"
  | "risky_dependency_change"
  | "unknown_dependency_risk";

type Detection = {
  type: DetectionType;
  evidence: string[];
  hypothesis: string;
  remediation: string;
  baseConfidence: number;
};

const extractEvidence = (event: EnrichedPipelineEvent): string[] => {
  const dependencyLines = (event.context.dependencies ?? []).map(
    (dependency) =>
      `${dependency.name}@${dependency.version} vulnerable=${dependency.vulnerable ?? false} cvss=${dependency.cvssScore ?? "unknown"} imported=${dependency.directlyImportedInChangedFiles ?? false}`
  );
  const manifestLines = (event.context.manifestContents ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
  const rawExcerpt = event.context.rawLogExcerpt ? [event.context.rawLogExcerpt] : [];

  return [...dependencyLines, ...manifestLines, ...rawExcerpt];
};

const detectDependencyIssue = (event: EnrichedPipelineEvent): Detection => {
  const dependencies = event.context.dependencies ?? [];
  const evidence = extractEvidence(event);

  const critical = dependencies.find((dependency) => (dependency.cvssScore ?? 0) >= 7);
  if (critical) {
    return {
      type: "critical_vulnerability",
      evidence: [
        `${critical.name}@${critical.version} cvss=${critical.cvssScore}`,
        ...evidence.slice(0, 2)
      ].filter(Boolean),
      hypothesis: "A high-severity dependency vulnerability is present in the changed dependency set.",
      remediation: "Pin or upgrade the vulnerable dependency to the last known safe version and rerun validation.",
      baseConfidence: 0.62
    };
  }

  const vulnerable = dependencies.find((dependency) => dependency.vulnerable);
  if (vulnerable) {
    return {
      type: "vulnerable_dependency",
      evidence: [
        `${vulnerable.name}@${vulnerable.version} vulnerable=true`,
        ...evidence.slice(0, 2)
      ].filter(Boolean),
      hypothesis: "The dependency set includes a package flagged as vulnerable, even if the severity is below the critical threshold.",
      remediation: "Review the advisory details and move the package to a patched version before deploying.",
      baseConfidence: 0.56
    };
  }

  const directlyImported = dependencies.find((dependency) => dependency.directlyImportedInChangedFiles);
  if (directlyImported) {
    return {
      type: "risky_dependency_change",
      evidence: [
        `${directlyImported.name}@${directlyImported.version} imported=true`,
        ...evidence.slice(0, 2)
      ].filter(Boolean),
      hypothesis: "A directly imported dependency changed in a sensitive code path and should be treated as a risky update.",
      remediation: "Verify compatibility of the directly imported dependency against the changed files and add targeted regression tests.",
      baseConfidence: 0.48
    };
  }

  return {
    type: "unknown_dependency_risk",
    evidence: evidence.slice(0, 3),
    hypothesis: "Dependency-related risk exists, but the available manifest evidence is too weak for a precise classification.",
    remediation: "Collect advisory data from OSV or NVD and compare the manifest against the last known good lockfile.",
    baseConfidence: 0.28
  };
};

export const scoreDependencyConfidence = (event: EnrichedPipelineEvent, detection: Detection): number => {
  let score = detection.baseConfidence;

  if ((event.context.dependencies ?? []).some((dependency) => (dependency.cvssScore ?? 0) >= 7)) {
    score += 0.3;
  }

  if ((event.context.dependencies ?? []).some((dependency) => dependency.directlyImportedInChangedFiles)) {
    score += 0.15;
  }

  return Math.min(1, Number(score.toFixed(2)));
};

const maybeAskLlmForSummary = async (event: EnrichedPipelineEvent, detection: Detection): Promise<string | null> => {
  const evidence = detection.evidence.join("\n") || "No strong dependency evidence provided.";

  try {
    const response = await chat(
      [
        {
          role: "system",
          content:
            "You summarize dependency risk in CI incidents. Answer in one sentence with clear security language and no markdown."
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

export const analyzeDependencies = async (event: EnrichedPipelineEvent): Promise<AgentFinding> => {
  const detection = detectDependencyIssue(event);
  const confidence = scoreDependencyConfidence(event, detection);
  const llmSummary = await maybeAskLlmForSummary(event, detection);

  return agentFindingSchema.parse({
    findingId: randomUUID(),
    agentId: "dependency_checker",
    eventId: event.eventId,
    hypothesis: llmSummary ?? detection.hypothesis,
    evidence:
      detection.evidence.length > 0
        ? detection.evidence
        : ["No high-signal dependency vulnerability evidence was found in the supplied manifest data."],
    confidence,
    proposedRemediation: detection.remediation,
    createdAt: new Date()
  });
};

export const issueChallenges = async ({ findings }: ChallengeRequest): Promise<Challenge[]> => {
  const dependencyFinding = findings.find((finding) => finding.agentId === "dependency_checker");

  if (!dependencyFinding) {
    return [];
  }

  return findings
    .filter((finding) => finding.agentId !== "dependency_checker")
    .filter((finding) => dependencyFinding.confidence >= finding.confidence)
    .filter((finding) => dependencyFinding.evidence.length > 0)
    .map((finding) =>
      createChallenge({
        challengerAgentId: "dependency_checker",
        targetAgentId: finding.agentId,
        counterHypothesis: `The dependency evidence more strongly supports a package-level risk than ${finding.agentId}'s hypothesis.`,
        evidence: dependencyFinding.evidence.slice(0, 2),
        confidence: Math.min(1, Number((dependencyFinding.confidence - finding.confidence + 0.55).toFixed(2)))
      })
    );
};

export const createDependencyRebuttal = async ({
  challenge,
  currentFinding
}: RebuttalRequest): Promise<Rebuttal> => {
  const mentionsDependency = /dependency|package|cve|cvss|manifest|lockfile/i.test(
    challenge.counterHypothesis
  );
  const position = mentionsDependency && currentFinding ? "DEFEND" : "CONCEDE";
  const rebuttalFactor = position === "DEFEND" ? 0.85 : 0.7;
  const baseConfidence = currentFinding?.confidence ?? 0.4;
  const updatedConfidence =
    position === "DEFEND"
      ? Math.max(0, Number((baseConfidence * 0.97).toFixed(2)))
      : Math.max(0, Number((baseConfidence * 0.82).toFixed(2)));

  return createRebuttal({
    respondingAgentId: "dependency_checker",
    challengeId: challenge.challengeId,
    position,
    updatedConfidence,
    rebuttalFactor
  });
};
