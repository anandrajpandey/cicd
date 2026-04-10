import { chat } from "@packages/llm-client";
import { type AgentFinding, type Rebuttal } from "@packages/shared-types";

import { createDecision, type JudgeWeights, type SynthesizeRequest } from "./schemas.js";

const DEFAULT_REBUTTAL_FACTOR = 1;

export const getRebuttalFactorForFinding = (finding: AgentFinding, rebuttals: Rebuttal[]): number => {
  const matching = rebuttals.filter((rebuttal) => rebuttal.respondingAgentId === finding.agentId);

  if (matching.length === 0) {
    return DEFAULT_REBUTTAL_FACTOR;
  }

  return Number(
    (
      matching.reduce((total, rebuttal) => total + rebuttal.rebuttalFactor, 0) / matching.length
    ).toFixed(4)
  );
};

export const computeCompositeScore = (
  findings: AgentFinding[],
  rebuttals: Rebuttal[],
  weights: JudgeWeights
): number => {
  const weightedSum = findings.reduce((total, finding) => {
    const weight = weights[finding.agentId] ?? 0;
    const rebuttalFactor = getRebuttalFactorForFinding(finding, rebuttals);
    return total + finding.confidence * weight * rebuttalFactor;
  }, 0);

  const weightSum = findings.reduce((total, finding) => total + (weights[finding.agentId] ?? 0), 0);
  if (weightSum === 0) {
    return 0;
  }

  return Number((weightedSum / weightSum).toFixed(4));
};

export const classifyRiskTier = (compositeScore: number): "LOW" | "MEDIUM" | "HIGH" => {
  if (compositeScore < 0.35) {
    return "LOW";
  }

  if (compositeScore <= 0.7) {
    return "MEDIUM";
  }

  return "HIGH";
};

export const recommendedActionForRisk = (riskTier: "LOW" | "MEDIUM" | "HIGH"): string => {
  if (riskTier === "LOW") {
    return "Proceed with automated remediation and record the action in the audit log.";
  }

  if (riskTier === "MEDIUM") {
    return "Send the decision to the approval queue for human review before remediation.";
  }

  return "Escalate immediately for human approval and incident response.";
};

const buildReasoningFallback = (
  findings: AgentFinding[],
  compositeScore: number,
  riskTier: "LOW" | "MEDIUM" | "HIGH"
): string => {
  const topFinding = [...findings].sort((a, b) => b.confidence - a.confidence)[0];
  return `The ${topFinding?.agentId ?? "judge"} signal is dominant, producing a composite score of ${compositeScore.toFixed(
    2
  )} and a ${riskTier} risk classification.`;
};

const maybeSummarizeDecision = async (
  request: SynthesizeRequest,
  compositeScore: number,
  riskTier: "LOW" | "MEDIUM" | "HIGH"
): Promise<string | null> => {
  const findingSummary = request.findings
    .map((finding) => `${finding.agentId}: confidence=${finding.confidence} hypothesis=${finding.hypothesis}`)
    .join("\n");

  try {
    const response = await chat(
      [
        {
          role: "system",
          content:
            "You summarize CI/CD risk decisions. Respond in one sentence with explicit risk and approval language, no markdown."
        },
        {
          role: "user",
          content: [
            `Composite score: ${compositeScore}`,
            `Risk tier: ${riskTier}`,
            "Findings:",
            findingSummary
          ].join("\n")
        }
      ],
      {
        temperature: 0,
        maxTokens: 140,
        timeoutMs: 4_000
      }
    );

    return response.trim() || null;
  } catch {
    return null;
  }
};

export const synthesizeDecision = async (request: SynthesizeRequest) => {
  const compositeScore = computeCompositeScore(request.findings, request.rebuttals, request.weights);
  const riskTier = classifyRiskTier(compositeScore);
  const llmReasoning = await maybeSummarizeDecision(request, compositeScore, riskTier);

  return createDecision({
    eventId: request.event.eventId,
    compositeScore,
    riskTier,
    reasoning: llmReasoning ?? buildReasoningFallback(request.findings, compositeScore, riskTier),
    recommendedAction: recommendedActionForRisk(riskTier),
    agentWeights: request.weights,
    createdAt: new Date()
  });
};
