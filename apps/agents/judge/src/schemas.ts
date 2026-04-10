import { randomUUID } from "node:crypto";

import {
  agentFindingSchema,
  decisionSchema,
  pipelineEventSchema,
  rebuttalSchema,
  type Decision
} from "@packages/shared-types";
import { z } from "zod";

export const judgeWeightsSchema = z.object({
  build_analyzer: z.number().positive().default(0.3),
  code_reviewer: z.number().positive().default(0.25),
  test_analyzer: z.number().positive().default(0.25),
  dependency_checker: z.number().positive().default(0.2)
});

export const synthesizeRequestSchema = z.object({
  event: pipelineEventSchema,
  findings: z.array(agentFindingSchema).min(1),
  rebuttals: z.array(rebuttalSchema).default([]),
  weights: judgeWeightsSchema.default({
    build_analyzer: 0.3,
    code_reviewer: 0.25,
    test_analyzer: 0.25,
    dependency_checker: 0.2
  })
});

export type SynthesizeRequest = z.infer<typeof synthesizeRequestSchema>;
export type JudgeWeights = z.infer<typeof judgeWeightsSchema>;

export const createDecision = (input: Omit<Decision, "decisionId">): Decision =>
  decisionSchema.parse({
    decisionId: randomUUID(),
    ...input
  });
