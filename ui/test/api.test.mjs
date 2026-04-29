import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createBacklogHandler } from "../server/app.mjs";

const currentFile = fileURLToPath(import.meta.url);
const fixturePath = path.join(path.dirname(currentFile), "fixtures", "REQ999.md");

async function invoke(handler, { method, url, body }) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.url = url;
  request.headers = body
    ? {
        "content-type": "application/json"
      }
    : {};

  let statusCode = 200;
  let headers = {};
  const chunks = [];

  const response = {
    writeHead(nextStatusCode, nextHeaders = {}) {
      statusCode = nextStatusCode;
      headers = nextHeaders;
    },
    end(chunk = "") {
      if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
    }
  };

  await handler(request, response);

  return {
    statusCode,
    headers,
    text: Buffer.concat(chunks).toString("utf8")
  };
}

test("la API lista items y persiste un guardado estructurado", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "backlog-ui-"));
  const itemsDir = path.join(tempRoot, "requirements", "req");
  await mkdir(itemsDir, { recursive: true });
  await copyFile(fixturePath, path.join(itemsDir, "REQ999.md"));

  const handler = createBacklogHandler({
    repoRoot: tempRoot,
    itemsDir,
    clientDistDir: path.join(tempRoot, "dist")
  });

  try {
    const listResponse = await invoke(handler, {
      method: "GET",
      url: "/api/items"
    });
    const items = JSON.parse(listResponse.text);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "REQ999");
    assert.equal(items[0].hasAssignee, true);
    assert.equal(items[0].hasTags, true);
    assert.equal(items[0].hasCriterios, false);

    const itemResponse = await invoke(handler, {
      method: "GET",
      url: "/api/items/REQ999"
    });
    const item = JSON.parse(itemResponse.text);

    const saveResponse = await invoke(handler, {
      method: "PUT",
      url: "/api/items/REQ999/structured",
      body: JSON.stringify({
        version: item.version,
        title: "HU-01 · Persistida",
        status: "testing",
        priority: "high",
        assignee: "Equipo QA",
        tags: ["column-testing"],
        sections: {
          historia: "Historia persistida",
          alcance: item.sections.alcance,
          criterios:
            "- Debe persistirse en disco\n- Debe recalcular el summary derivado",
          notas: item.sections.notas,
          observaciones: item.sections.observaciones
        }
      })
    });

    assert.equal(saveResponse.statusCode, 200);
    const updated = JSON.parse(saveResponse.text);
    assert.equal(updated.status, "testing");
    assert.equal(updated.priority, "high");
    assert.equal(updated.hasCriterios, true);

    const persisted = await readFile(path.join(itemsDir, "REQ999.md"), "utf8");
    assert.equal(persisted.includes("HU-01 · Persistida"), true);
    assert.equal(persisted.includes("status: testing"), true);
    assert.equal(persisted.includes("priority: high"), true);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
