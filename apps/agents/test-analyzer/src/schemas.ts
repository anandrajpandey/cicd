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

const failingTestSchema = z.object({
  name: z.string().min(1),
  historicalFailureRate: z.number().min(0).max(1).optional(),
  hasNeverFailedBefore: z.boolean().optional()
});

const testContextSchema = z.object({
  rawTestReport: z.string().optional(),
  failingTests: z.array(failingTestSchema).optional(),
  changedLineCoverage: z.number().min(0).max(1).optional(),
  rawLogExcerpt: z.string().optional()
});

export const enrichedPipelineEventSchema = pipelineEventSchema.extend({
  context: testContextSchema.default({})
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
    agentId: "test_analyzer",
    eventId: event.eventId,
    hypothesis: "The test analyzer timed out before parsing the failing test report.",
    evidence: ["TIMEOUT"],
    confidence: 0,
    proposedRemediation: "Retry the analysis request and inspect the failing test suite manually.",
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
