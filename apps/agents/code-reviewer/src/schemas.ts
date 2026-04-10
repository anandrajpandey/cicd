import { randomUUID } from "node:crypto";

import {
  agentFindingSchema,
  challengeSchema,
  pipelineEventSchema,
  rebuttalSchema,
  type AgentFinding,
  type Challenge,
  type PipelineEvent,
  type Rebuttal
} from "@packages/shared-types";
import { z } from "zod";

const codeContextSchema = z.object({
  gitDiff: z.string().optional(),
  changedFiles: z.array(z.string()).optional(),
  linkedCvssScore: z.number().min(0).max(10).optional(),
  suspiciousPatterns: z.array(z.string()).optional()
});

export const enrichedPipelineEventSchema = pipelineEventSchema.extend({
  context: codeContextSchema.default({})
});

export const challengeRequestSchema = z.object({
  event: enrichedPipelineEventSchema,
  findings: z.array(agentFindingSchema)
});

export const rebuttalRequestSchema = z.object({
  event: enrichedPipelineEventSchema,
  challenge: challengeSchema,
  currentFinding: agentFindingSchema.optional()
});

export type EnrichedPipelineEvent = z.infer<typeof enrichedPipelineEventSchema>;
export type ChallengeRequest = z.infer<typeof challengeRequestSchema>;
export type RebuttalRequest = z.infer<typeof rebuttalRequestSchema>;

export const createTimeoutFinding = (event: PipelineEvent): AgentFinding =>
  agentFindingSchema.parse({
    findingId: randomUUID(),
    agentId: "code_reviewer",
    eventId: event.eventId,
    hypothesis: "The code reviewer timed out before it could inspect the diff.",
    evidence: ["TIMEOUT"],
    confidence: 0,
    proposedRemediation: "Retry the analysis request and inspect the changed files manually.",
    createdAt: new Date()
  });

export const createRebuttal = (input: Omit<Rebuttal, "rebuttalId">): Rebuttal =>
  rebuttalSchema.parse({
    rebuttalId: randomUUID(),
    ...input
  });

export const createChallenge = (input: Omit<Challenge, "challengeId">): Challenge =>
  challengeSchema.parse({
    challengeId: randomUUID(),
    ...input
  });
