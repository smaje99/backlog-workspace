import { spawn } from "node:child_process";

const apiPort = process.env.BACKLOG_API_PORT ?? "8794";
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const nodeCommand = process.execPath;

const processes = [];

function start(label, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      BACKLOG_API_PORT: apiPort,
      ...extraEnv
    },
    stdio: "inherit"
  });

  child.on("exit", (code, signal) => {
    if (signal || code !== 0) {
      process.exitCode = code ?? 1;
    }
    for (const running of processes) {
      if (running !== child && !running.killed) {
        running.kill("SIGTERM");
      }
    }
  });

  processes.push(child);
  return child;
}

start("api", nodeCommand, ["--watch", "./server/index.mjs"]);
start("client", pnpmCommand, ["exec", "vite", "--config", "./vite.config.ts"]);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const child of processes) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    }
  });
}
