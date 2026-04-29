import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildStructuredMarkdown,
  parseItemDocument
} from "../server/lib/markdown-item.mjs";

const currentFile = fileURLToPath(import.meta.url);
const fixturePath = path.join(path.dirname(currentFile), "fixtures", "REQ999.md");

test("parsea un REQ y expone sus campos estructurados", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const parsed = parseItemDocument(raw);

  assert.equal(parsed.title, "HU-01 · Historia base");
  assert.equal(parsed.frontmatter.status, "backlog");
  assert.equal(parsed.sectionsMap.historia.includes("usuario"), true);
  assert.equal(parsed.sectionsMap.alcance.includes("UI local"), true);
});

test("reescribe campos estructurados preservando secciones y frontmatter", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const parsed = parseItemDocument(raw);

  const nextMarkdown = buildStructuredMarkdown(parsed, {
    version: parsed.version,
    title: "HU-01 · Historia editada",
    status: "testing",
    priority: "p1",
    assignee: "Equipo QA",
    tags: ["column-testing", "manual"],
    sections: {
      historia: "Historia actualizada",
      alcance: parsed.sectionsMap.alcance,
      criterios: "Criterio actualizado",
      notas: "Notas actualizadas",
      observaciones: "Observaciones actualizadas"
    }
  });

  const reparsed = parseItemDocument(nextMarkdown);
  assert.equal(reparsed.title, "HU-01 · Historia editada");
  assert.equal(reparsed.frontmatter.status, "testing");
  assert.deepEqual(reparsed.frontmatter.tags, ["column-testing", "manual"]);
  assert.equal(reparsed.sectionsMap.criterios, "Criterio actualizado");
  assert.equal(reparsed.frontmatter.links[0], "REQ002: abc123=");
});

test("acepta prioridades high y low al reescribir el documento", async () => {
  const raw = await readFile(fixturePath, "utf8");
  const parsed = parseItemDocument(raw);

  const highMarkdown = buildStructuredMarkdown(parsed, {
    version: parsed.version,
    title: parsed.title,
    status: "backlog",
    priority: "high",
    assignee: "Equipo UX",
    tags: parsed.frontmatter.tags,
    sections: parsed.sectionsMap
  });

  const highParsed = parseItemDocument(highMarkdown);
  assert.equal(highParsed.frontmatter.priority, "high");

  const lowMarkdown = buildStructuredMarkdown(highParsed, {
    version: highParsed.version,
    title: highParsed.title,
    status: "backlog",
    priority: "low",
    assignee: "Equipo UX",
    tags: highParsed.frontmatter.tags,
    sections: highParsed.sectionsMap
  });

  const lowParsed = parseItemDocument(lowMarkdown);
  assert.equal(lowParsed.frontmatter.priority, "low");
});
