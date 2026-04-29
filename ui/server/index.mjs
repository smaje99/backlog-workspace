import path from "node:path";
import { fileURLToPath } from "node:url";

import { createBacklogServer } from "./app.mjs";

const currentFile = fileURLToPath(import.meta.url);
const uiDir = path.resolve(path.dirname(currentFile), "..");
const repoRoot = path.resolve(uiDir, "..");
const port = Number(process.env.BACKLOG_API_PORT ?? process.env.PORT ?? 8794);
const host = process.env.HOST ?? "127.0.0.1";

const server = createBacklogServer({ repoRoot });

server.listen(port, host, () => {
  console.log(`Backlog API escuchando en http://${host}:${port}`);
});
