import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";

import { pipelineEventSchema, type PipelineEvent } from "@packages/shared-types";
import { z } from "zod";

const githubPayloadSchema = z.object({
  action: z.string().optional(),
  workflow_run: z.object({
    id: z.number().int().optional(),
    head_sha: z.string().min(1),
    head_branch: z.string().min(1),
    html_url: z.string().url(),
    status: z.string().optional(),
    conclusion: z.string().nullable().optional(),
    repository: z.object({
      full_name: z.string().min(1)
    }).optional()
  }).optional(),
  repository: z.object({
    full_name: z.string().min(1)
  })
});

const jenkinsPayloadSchema = z.object({
  repository: z.string().min(1),
  commitSha: z.string().min(1),
  branch: z.string().min(1),
  failureType: z.string().min(1).optional(),
  rawLogsRef: z.string().url().optional(),
  build: z.object({
    id: z.union([z.string(), z.number()]).optional(),
    number: z.number().int().optional(),
    status: z.string().optional(),
    url: z.string().url().optional()
  }).optional()
});

const cloudwatchPayloadSchema = z.object({
  id: z.string().optional(),
  source: z.string().optional(),
  time: z.string().optional(),
  detail: z.object({
    repository: z.string().min(1),
    commitSha: z.string().min(1),
    branch: z.string().min(1),
    failureType: z.string().min(1).optional(),
    rawLogsRef: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
});

const xrayPayloadSchema = z.object({
  id: z.string().optional(),
  time: z.string().optional(),
  detail: z.object({
    repository: z.string().min(1),
    commitSha: z.string().min(1),
    branch: z.string().min(1),
    failureType: z.string().min(1).optional(),
    rawLogsRef: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
});

export const verifyHmacSignature = (rawBody: string, signature: string | undefined, secret: string): boolean => {
  if (!signature) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const normalized = signature.startsWith("sha256=") ? signature.slice(7) : signature;

  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(normalized, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};

export const normalizeGitHubEvent = (payload: unknown): PipelineEvent => {
  const parsed = githubPayloadSchema.parse(payload);
  const workflowRun = parsed.workflow_run;
  const failureType =
    workflowRun?.conclusion ?? workflowRun?.status ?? "workflow_run_pending";

  return pipelineEventSchema.parse({
    eventId: randomUUID(),
    sourceTool: "github_actions",
    repository: parsed.repository.full_name,
    commitSha: workflowRun?.head_sha ?? "unknown",
    branch: workflowRun?.head_branch ?? "unknown",
    failureType,
    rawLogsRef: workflowRun?.html_url ?? "https://github.com",
    metadata: {
      action: parsed.action ?? "workflow_run",
      workflowRunId: workflowRun?.id ?? null,
      workflowRunStatus: workflowRun?.status ?? null,
      workflowRunConclusion: workflowRun?.conclusion ?? null
    },
    timestamp: new Date()
  });
};

export const normalizeJenkinsEvent = (payload: unknown): PipelineEvent => {
  const parsed = jenkinsPayloadSchema.parse(payload);

  return pipelineEventSchema.parse({
    eventId: randomUUID(),
    sourceTool: "jenkins",
    repository: parsed.repository,
    commitSha: parsed.commitSha,
    branch: parsed.branch,
    failureType: parsed.failureType ?? parsed.build?.status ?? "build_failure",
    rawLogsRef: parsed.rawLogsRef ?? parsed.build?.url ?? "https://jenkins.invalid/logs",
    metadata: {
      buildId: parsed.build?.id ?? null,
      buildNumber: parsed.build?.number ?? null,
      buildStatus: parsed.build?.status ?? null
    },
    timestamp: new Date()
  });
};

export const normalizeCloudWatchEvent = (payload: unknown): PipelineEvent => {
  const parsed = cloudwatchPayloadSchema.parse(payload);

  return pipelineEventSchema.parse({
    eventId: randomUUID(),
    sourceTool: "cloudwatch",
    repository: parsed.detail.repository,
    commitSha: parsed.detail.commitSha,
    branch: parsed.detail.branch,
    failureType: parsed.detail.failureType ?? "cloudwatch_alarm",
    rawLogsRef: parsed.detail.rawLogsRef,
    metadata: {
      source: parsed.source ?? "aws.cloudwatch",
      ...(parsed.detail.metadata ?? {})
    },
    timestamp: parsed.time ? new Date(parsed.time) : new Date()
  });
};

export const normalizeXRayEvent = (payload: unknown): PipelineEvent => {
  const parsed = xrayPayloadSchema.parse(payload);

  return pipelineEventSchema.parse({
    eventId: randomUUID(),
    sourceTool: "xray",
    repository: parsed.detail.repository,
    commitSha: parsed.detail.commitSha,
    branch: parsed.detail.branch,
    failureType: parsed.detail.failureType ?? "trace_anomaly",
    rawLogsRef: parsed.detail.rawLogsRef,
    metadata: parsed.detail.metadata ?? {},
    timestamp: parsed.time ? new Date(parsed.time) : new Date()
  });
};
