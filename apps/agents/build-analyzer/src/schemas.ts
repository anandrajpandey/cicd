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

const buildContextSchema = z.object({
  gitDiff: z.string().optional(),
  jenkinsLogLines: z.array(z.string()).optional(),
  recentBuildFailureMatches: z.number().int().min(0).max(3).optional(),
  touchedFiles: z.array(z.string()).optional(),
  rawLogExcerpt: z.string().optional()
});

export const enrichedPipelineEventSchema = pipelineEventSchema.extend({
  context: buildContextSchema.default({})
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
    agentId: "build_analyzer",
    eventId: event.eventId,
    hypothesis: "The build analyzer timed out before a diagnosis could be completed.",
    evidence: ["TIMEOUT"],
    confidence: 0,
    proposedRemediation: "Retry the analysis request and inspect the raw build logs.",
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
