import Fastify, { type FastifyInstance } from "fastify";
import rawBody from "fastify-raw-body";

import { TOPICS, publishMessage } from "@packages/kafka-client";
import type { PipelineEvent } from "@packages/shared-types";
import { ZodError } from "zod";

import {
  normalizeCloudWatchEvent,
  normalizeGitHubEvent,
  normalizeJenkinsEvent,
  normalizeXRayEvent,
  verifyHmacSignature
} from "./normalizers.js";
import { orchestrateIncident } from "./orchestration.js";

type EventPublisher = (event: PipelineEvent) => Promise<void>;

type BuildServerOptions = {
  publishEvent?: EventPublisher;
  orchestratorDependencies?: Parameters<typeof orchestrateIncident>[1];
};

const defaultPublishEvent: EventPublisher = async (event) => {
  await publishMessage({
    topic: TOPICS.pipelineEvents,
    repository: event.repository,
    payload: event
  });
};

const getRawBody = (request: { rawBody?: string | Buffer }): string => {
  const raw = request.rawBody;

  if (typeof raw === "string") {
    return raw;
  }

  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }

  return "";
};

const sendNormalizationError = (reply: { code: (statusCode: number) => { send: (body: unknown) => void } }, error: unknown) => {
  if (error instanceof ZodError) {
    reply.code(400).send({
      message: "Malformed webhook payload",
      issues: error.issues
    });
    return;
  }

  reply.code(500).send({
    message: "Unexpected webhook processing error"
  });
};

export const buildServer = async (options: BuildServerOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: false
  });

  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
    routes: ["/webhook/jenkins", "/webhook/github"]
  });

  const publishEvent = options.publishEvent ?? defaultPublishEvent;
  const orchestratorDependencies = options.orchestratorDependencies;

  app.post("/webhook/jenkins", async (request, reply) => {
    const secret = process.env.JENKINS_WEBHOOK_SECRET ?? process.env.JENKINS_TOKEN;
    // TODO: replace this fallback once a dedicated Jenkins webhook secret is added to the env contract.
    if (!secret) {
      reply.code(500).send({ message: "Jenkins webhook secret is not configured" });
      return;
    }

    const signature = request.headers["x-jenkins-signature"];
    const normalizedSignature = Array.isArray(signature) ? signature[0] : signature;

    if (!verifyHmacSignature(getRawBody(request), normalizedSignature, secret)) {
      reply.code(401).send({ message: "Invalid Jenkins webhook signature" });
      return;
    }

    try {
      const event = normalizeJenkinsEvent(request.body);
      await publishEvent(event);
      reply.code(202).send({ message: "Accepted", eventId: event.eventId });
    } catch (error) {
      sendNormalizationError(reply, error);
    }
  });

  app.post("/webhook/github", async (request, reply) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!secret) {
      reply.code(500).send({ message: "GitHub webhook secret is not configured" });
      return;
    }

    const signature = request.headers["x-hub-signature-256"];
    const normalizedSignature = Array.isArray(signature) ? signature[0] : signature;

    if (!verifyHmacSignature(getRawBody(request), normalizedSignature, secret)) {
      reply.code(401).send({ message: "Invalid GitHub webhook signature" });
      return;
    }

    try {
      const event = normalizeGitHubEvent(request.body);
      await publishEvent(event);
      reply.code(202).send({ message: "Accepted", eventId: event.eventId });
    } catch (error) {
      sendNormalizationError(reply, error);
    }
  });

  app.post("/webhook/cloudwatch", async (request, reply) => {
    try {
      const event = normalizeCloudWatchEvent(request.body);
      await publishEvent(event);
      reply.code(202).send({ message: "Accepted", eventId: event.eventId });
    } catch (error) {
      sendNormalizationError(reply, error);
    }
  });

  app.post("/webhook/xray", async (request, reply) => {
    try {
      const event = normalizeXRayEvent(request.body);
      await publishEvent(event);
      reply.code(202).send({ message: "Accepted", eventId: event.eventId });
    } catch (error) {
      sendNormalizationError(reply, error);
    }
  });

  app.post("/internal/orchestrate", async (request, reply) => {
    if (!orchestratorDependencies) {
      reply.code(501).send({
        message: "Orchestration dependencies are not configured"
      });
      return;
    }

    try {
      const event = request.body as PipelineEvent;
      const result = await orchestrateIncident(event, orchestratorDependencies);
      reply.code(200).send(result);
    } catch (error) {
      sendNormalizationError(reply, error);
    }
  });

  return app;
};
