import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ItemStore } from "./lib/item-store.mjs";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function notFound(response) {
  json(response, 404, { error: "Recurso no encontrado." });
}

function sanitizeRelativePath(rootDir, requestedPath) {
  const resolved = path.resolve(rootDir, requestedPath);
  if (!resolved.startsWith(rootDir)) {
    return null;
  }
  return resolved;
}

function parseFilters(searchParams) {
  const readValues = (key) =>
    searchParams
      .getAll(key)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean);

  return {
    statuses: readValues("status"),
    priorities: readValues("priority"),
    assignees: readValues("assignee"),
    tags: readValues("tag"),
    search: searchParams.get("search")?.trim() ?? ""
  };
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStaticFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType =
    MIME_TYPES[extension] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(response);
}

async function serveClientAsset(response, clientDistDir, pathname) {
  const relativePath = pathname === "/" ? "/index.html" : pathname;
  const candidate = sanitizeRelativePath(clientDistDir, `.${relativePath}`);

  if (!candidate) {
    notFound(response);
    return;
  }

  try {
    const details = await stat(candidate);
    if (details.isFile()) {
      await serveStaticFile(response, candidate);
      return;
    }
  } catch {
    if (pathname !== "/") {
      const indexFile = path.join(clientDistDir, "index.html");
      await serveStaticFile(response, indexFile);
      return;
    }
  }

  const indexFile = path.join(clientDistDir, "index.html");
  await serveStaticFile(response, indexFile);
}

export function createBacklogServer(options = {}) {
  return http.createServer(createBacklogHandler(options));
}

export function createBacklogHandler(options = {}) {
  const currentFile = fileURLToPath(import.meta.url);
  const uiDir = path.resolve(path.dirname(currentFile), "..");
  const repoRoot = options.repoRoot ?? path.resolve(uiDir, "..");
  const itemsDir =
    options.itemsDir ?? path.join(repoRoot, "requirements", "req");
  const clientDistDir = options.clientDistDir ?? path.join(uiDir, "dist");
  const store = new ItemStore({ repoRoot, itemsDir });

  return async (request, response) => {
    try {
      if (!request.url) {
        notFound(response);
        return;
      }

      const url = new URL(request.url, "http://localhost");
      const pathname = url.pathname;

      if (pathname === "/api/meta" && request.method === "GET") {
        json(response, 200, await store.getMeta());
        return;
      }

      if (pathname === "/api/items" && request.method === "GET") {
        json(response, 200, await store.listItems(parseFilters(url.searchParams)));
        return;
      }

      if (pathname.startsWith("/api/items/")) {
        const [, , , id, action] = pathname.split("/");

        if (!id) {
          notFound(response);
          return;
        }

        if (!action && request.method === "GET") {
          json(response, 200, await store.readItem(id));
          return;
        }

        if (action === "structured" && request.method === "PUT") {
          const payload = await readJsonBody(request);
          json(response, 200, await store.saveStructured(id, payload));
          return;
        }

        if (action === "raw" && request.method === "PUT") {
          const payload = await readJsonBody(request);
          json(response, 200, await store.saveRaw(id, payload));
          return;
        }
      }

      if (pathname === "/app-assets" && request.method === "GET") {
        const requestedPath = url.searchParams.get("path");
        if (!requestedPath) {
          notFound(response);
          return;
        }

        const resolvedPath = sanitizeRelativePath(repoRoot, requestedPath);
        if (!resolvedPath) {
          notFound(response);
          return;
        }

        await serveStaticFile(response, resolvedPath);
        return;
      }

      try {
        await access(clientDistDir);
        await serveClientAsset(response, clientDistDir, pathname);
        return;
      } catch {
        if (pathname === "/" || pathname === "/index.html") {
          json(response, 200, {
            message:
              "La API está activa. Ejecuta `pnpm build` para servir la interfaz compilada desde este proceso."
          });
          return;
        }
      }

      notFound(response);
    } catch (error) {
      if (error?.code === "ENOENT") {
        notFound(response);
        return;
      }

      if (error?.code === "VERSION_CONFLICT") {
        json(response, 409, { error: error.message });
        return;
      }

      json(response, 400, {
        error: error instanceof Error ? error.message : "Error inesperado."
      });
    }
  };
}
