import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { createJudgeAdkAgent } from "./adk.js";
import { synthesizeRequestSchema } from "./schemas.js";
import { synthesizeDecision } from "./service.js";

export type JudgeServerOptions = {
  appName?: string;
};

const sendValidationError = (
  reply: { code: (statusCode: number) => { send: (body: unknown) => void } },
  error: unknown
): void => {
  if (error instanceof ZodError) {
    reply.code(400).send({
      message: "Malformed judge payload",
      issues: error.issues
    });
    return;
  }

  reply.code(500).send({
    message: "Unexpected judge error"
  });
};

export const buildServer = async (options: JudgeServerOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: false
  });

  const adkAgent = createJudgeAdkAgent();
  app.decorate("judgeMetadata", {
    appName: options.appName ?? "judge",
    adkAgentName: adkAgent.name
  });

  app.get("/health", async () => ({
    status: "ok",
    agent: adkAgent.name
  }));

  app.post("/synthesize", async (request, reply) => {
    try {
      const payload = synthesizeRequestSchema.parse(request.body);
      const decision = await synthesizeDecision(payload);
      reply.code(200).send(decision);
    } catch (error) {
      sendValidationError(reply, error);
    }
  });

  return app;
};
