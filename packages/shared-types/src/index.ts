import { z } from "zod";

export const sharedTypesPackageName = "shared-types";

const uuidSchema = z.string().uuid();
const dateSchema = z.coerce.date();
const confidenceSchema = z.number().min(0).max(1);
const metadataSchema = z.record(z.string(), z.unknown());

export const pipelineEventSchema = z.object({
  eventId: uuidSchema,
  sourceTool: z.enum(["jenkins", "github_actions", "cloudwatch", "xray"]),
  repository: z.string().min(1),
  commitSha: z.string().min(1),
  branch: z.string().min(1),
  failureType: z.string().min(1),
  rawLogsRef: z.string().min(1),
  metadata: metadataSchema,
  timestamp: dateSchema
});

export const agentFindingSchema = z.object({
  findingId: uuidSchema,
  agentId: z.enum([
    "build_analyzer",
    "code_reviewer",
    "test_analyzer",
    "dependency_checker"
  ]),
  eventId: uuidSchema,
  hypothesis: z.string().min(1),
  evidence: z.array(z.string()),
  confidence: confidenceSchema,
  proposedRemediation: z.string().min(1),
  createdAt: dateSchema
});

export const challengeSchema = z.object({
  challengeId: uuidSchema,
  challengerAgentId: z.string().min(1),
  targetAgentId: z.string().min(1),
  counterHypothesis: z.string().min(1),
  evidence: z.array(z.string()),
  confidence: confidenceSchema
});

export const rebuttalSchema = z.object({
  rebuttalId: uuidSchema,
  respondingAgentId: z.string().min(1),
  challengeId: uuidSchema,
  position: z.enum(["DEFEND", "CONCEDE"]),
  updatedConfidence: confidenceSchema,
  rebuttalFactor: z.number().min(0)
});

export const decisionSchema = z.object({
  decisionId: uuidSchema,
  eventId: uuidSchema,
  compositeScore: z.number(),
  riskTier: z.enum(["LOW", "MEDIUM", "HIGH"]),
  reasoning: z.string().min(1),
  recommendedAction: z.string().min(1),
  agentWeights: z.record(z.string(), z.number()),
  createdAt: dateSchema
});

export const approvalSchema = z.object({
  approvalId: uuidSchema,
  decisionId: uuidSchema,
  approverId: z.string().min(1),
  action: z.enum(["APPROVE", "REJECT", "OVERRIDE"]),
  justification: z.string().min(1),
  createdAt: dateSchema
});

export const auditEntrySchema = z.object({
  entryId: uuidSchema,
  eventId: uuidSchema,
  stepType: z.string().min(1),
  actor: z.string().min(1),
  payload: z.unknown(),
  timestamp: dateSchema
});

export type PipelineEvent = z.infer<typeof pipelineEventSchema>;
export type AgentFinding = z.infer<typeof agentFindingSchema>;
export type Challenge = z.infer<typeof challengeSchema>;
export type Rebuttal = z.infer<typeof rebuttalSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
