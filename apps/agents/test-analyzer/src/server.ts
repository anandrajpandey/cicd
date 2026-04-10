import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { createTestAnalyzerAdkAgent } from "./adk.js";
import { challengeRequestSchema, enrichedPipelineEventSchema, rebuttalRequestSchema } from "./schemas.js";
import { analyzeTests, createTestRebuttal, issueChallenges } from "./service.js";

export type TestAnalyzerServerOptions = {
  appName?: string;
};

const sendValidationError = (
  reply: { code: (statusCode: number) => { send: (body: unknown) => void } },
  error: unknown
): void => {
  if (error instanceof ZodError) {
    reply.code(400).send({
      message: "Malformed test-analyzer payload",
      issues: error.issues
    });
    return;
  }

  reply.code(500).send({
    message: "Unexpected test-analyzer error"
  });
};

export const buildServer = async (
  options: TestAnalyzerServerOptions = {}
): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: false
  });

  const adkAgent = createTestAnalyzerAdkAgent();
  app.decorate("testAnalyzerMetadata", {
    appName: options.appName ?? "test-analyzer",
    adkAgentName: adkAgent.name
  });

  app.get("/health", async () => ({
    status: "ok",
    agent: adkAgent.name
  }));

  app.post("/analyze", async (request, reply) => {
    try {
      const event = enrichedPipelineEventSchema.parse(request.body);
      const finding = await analyzeTests(event);
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
      const rebuttal = await createTestRebuttal(payload);
      reply.code(200).send(rebuttal);
    } catch (error) {
      sendValidationError(reply, error);
    }
  });

  return app;
};
