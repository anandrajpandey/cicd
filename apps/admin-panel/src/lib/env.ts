import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const readWorkspaceEnvVar = (name: string): string | undefined => {
  const candidatePaths = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
    resolve(process.cwd(), "../../../.env")
  ];

  for (const candidatePath of candidatePaths) {
    if (!existsSync(candidatePath)) {
      continue;
    }

    const match = readFileSync(candidatePath, "utf8")
      .split(/\r?\n/)
      .find((line) => line.startsWith(`${name}=`));

    if (match) {
      return match.slice(name.length + 1).trim();
    }
  }

  return undefined;
};
