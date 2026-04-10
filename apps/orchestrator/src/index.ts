import { buildServer } from "./server.js";
import { fileURLToPath } from "node:url";

const main = async () => {
  const app = await buildServer();

  try {
    const port = Number.parseInt(process.env.PORT ?? "4000", 10);
    await app.listen({
      port,
      host: "0.0.0.0"
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void main();
}

export { buildServer } from "./server.js";
export {
  dispatchAgentFindings,
  enrichPipelineEvent,
  orchestrateIncident,
  routeDecision,
  runDebate
} from "./orchestration.js";
