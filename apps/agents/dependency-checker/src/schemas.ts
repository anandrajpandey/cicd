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

const dependencySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  ecosystem: z.string().optional(),
  cvssScore: z.number().min(0).max(10).optional(),
  vulnerable: z.boolean().optional(),
  directlyImportedInChangedFiles: z.boolean().optional()
});

const dependencyContextSchema = z.object({
  manifestContents: z.string().optional(),
  dependencies: z.array(dependencySchema).optional(),
  changedFiles: z.array(z.string()).optional(),
  rawLogExcerpt: z.string().optional()
});

export const enrichedPipelineEventSchema = pipelineEventSchema.extend({
  context: dependencyContextSchema.default({})
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
    agentId: "dependency_checker",
    eventId: event.eventId,
    hypothesis: "The dependency checker timed out before evaluating vulnerable packages.",
    evidence: ["TIMEOUT"],
    confidence: 0,
    proposedRemediation: "Retry the analysis request and inspect the dependency manifest manually.",
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
