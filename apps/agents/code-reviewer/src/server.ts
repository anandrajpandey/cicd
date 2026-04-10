import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { createCodeReviewerAdkAgent } from "./adk.js";
import { challengeRequestSchema, enrichedPipelineEventSchema, rebuttalRequestSchema } from "./schemas.js";
import { analyzeCodeReview, createCodeRebuttal, issueChallenges } from "./service.js";

export type CodeReviewerServerOptions = {
  appName?: string;
};

const sendValidationError = (
  reply: { code: (statusCode: number) => { send: (body: unknown) => void } },
  error: unknown
): void => {
  if (error instanceof ZodError) {
    reply.code(400).send({
      message: "Malformed code-reviewer payload",
      issues: error.issues
    });
    return;
  }

  reply.code(500).send({
    message: "Unexpected code-reviewer error"
  });
};

export const buildServer = async (
  options: CodeReviewerServerOptions = {}
): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: false
  });

  const adkAgent = createCodeReviewerAdkAgent();
  app.decorate("codeReviewerMetadata", {
    appName: options.appName ?? "code-reviewer",
    adkAgentName: adkAgent.name
  });

  app.get("/health", async () => ({
    status: "ok",
    agent: adkAgent.name
  }));

  app.post("/analyze", async (request, reply) => {
    try {
      const event = enrichedPipelineEventSchema.parse(request.body);
      const finding = await analyzeCodeReview(event);
      reply.code(200).send(finding);
    } catch (error) {
      sendValidationError(reply, error);
    }
  });

  app.post("/challenge", async (request, reply) => {
    try {
      const payload = challengeRequestSchema.parse(request.body);
      const challenges = await issueChallenges(payload);
      reply.code(200).send(challenges);
    } catch (error) {
      sendValidationError(reply, error);
    }
  });

  app.post("/rebuttal", async (request, reply) => {
    try {
      const payload = rebuttalRequestSchema.parse(request.body);
      const rebuttal = await createCodeRebuttal(payload);
      reply.code(200).send(rebuttal);
    } catch (error) {
      sendValidationError(reply, error);
    }
  });

  return app;
};
