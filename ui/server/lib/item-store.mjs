import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildStructuredMarkdown,
  parseItemDocument,
  toItemEntity,
  validateRawMarkdown
} from "./markdown-item.mjs";

function matchesFilter(item, filters) {
  const statuses =
    filters.statuses.length > 0 ? new Set(filters.statuses) : null;
  const priorities =
    filters.priorities.length > 0 ? new Set(filters.priorities) : null;
  const assignees =
    filters.assignees.length > 0 ? new Set(filters.assignees) : null;
  const tags = filters.tags.length > 0 ? new Set(filters.tags) : null;
  const query = filters.search.toLowerCase();

  if (statuses && !statuses.has(item.status)) {
    return false;
  }

  if (priorities && !priorities.has(item.priority)) {
    return false;
  }

  if (assignees && !assignees.has(item.assignee)) {
    return false;
  }

  if (tags && !item.tags.some((tag) => tags.has(tag))) {
    return false;
  }

  if (!query) {
    return true;
  }

  const haystack = [
    item.id,
    item.title,
    item.assignee,
    item.priority,
    item.status,
    item.sourceSection,
    ...item.tags,
    item.sections.historia,
    item.sections.alcance,
    item.sections.criterios,
    item.sections.notas,
    item.sections.observaciones
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(query);
}

function summarizeItem(item) {
  return {
    id: item.id,
    path: item.path,
    title: item.title,
    status: item.status,
    priority: item.priority,
    assignee: item.assignee,
    hasAssignee: item.hasAssignee,
    createdAt: item.createdAt,
    sourceSection: item.sourceSection,
    tags: item.tags,
    hasTags: item.hasTags,
    hasCriterios: item.hasCriterios,
    links: item.links,
    references: item.references,
    preview: item.preview
  };
}

export class ItemStore {
  constructor({ repoRoot, itemsDir }) {
    this.repoRoot = repoRoot;
    this.itemsDir = itemsDir;
  }

  async listItemPaths() {
    const entries = await readdir(this.itemsDir, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          /^REQ\d+\.md$/i.test(entry.name)
      )
      .map((entry) => path.join(this.itemsDir, entry.name))
      .sort();
  }

  async readItem(id) {
    const normalizedId = id.toUpperCase();
    const filePath = path.join(this.itemsDir, `${normalizedId}.md`);
    const rawMarkdown = await readFile(filePath, "utf8");
    const parsed = parseItemDocument(rawMarkdown);
    return toItemEntity(
      normalizedId,
      parsed,
      path.relative(this.repoRoot, filePath)
    );
  }

  async listItems(filters) {
    const paths = await this.listItemPaths();
    const items = [];

    for (const filePath of paths) {
      const rawMarkdown = await readFile(filePath, "utf8");
      const parsed = parseItemDocument(rawMarkdown);
      const id = path.basename(filePath, ".md").toUpperCase();
      const item = toItemEntity(id, parsed, path.relative(this.repoRoot, filePath));

      if (matchesFilter(item, filters)) {
        items.push(summarizeItem(item));
      }
    }

    return items;
  }

  async getMeta() {
    const items = await this.listItems({
      statuses: [],
      priorities: [],
      assignees: [],
      tags: [],
      search: ""
    });

    const counts = {
      total: items.length,
      statuses: {},
      priorities: {},
      assignees: {},
      tags: {}
    };

    for (const item of items) {
      counts.statuses[item.status] = (counts.statuses[item.status] ?? 0) + 1;
      counts.priorities[item.priority] =
        (counts.priorities[item.priority] ?? 0) + 1;
      counts.assignees[item.assignee] = (counts.assignees[item.assignee] ?? 0) + 1;

      for (const tag of item.tags) {
        counts.tags[tag] = (counts.tags[tag] ?? 0) + 1;
      }
    }

    return counts;
  }

  async saveStructured(id, payload) {
    const normalizedId = id.toUpperCase();
    const filePath = path.join(this.itemsDir, `${normalizedId}.md`);
    const currentRaw = await readFile(filePath, "utf8");
    const currentParsed = parseItemDocument(currentRaw);

    if (currentParsed.version !== payload.version) {
      const error = new Error("El archivo cambió en disco. Recarga antes de guardar.");
      error.code = "VERSION_CONFLICT";
      throw error;
    }

    const nextMarkdown = buildStructuredMarkdown(currentParsed, payload);
    await writeFile(filePath, nextMarkdown, "utf8");
    return this.readItem(normalizedId);
  }

  async saveRaw(id, payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("La carga de Markdown es inválida.");
    }

    const normalizedId = id.toUpperCase();
    const filePath = path.join(this.itemsDir, `${normalizedId}.md`);
    const currentRaw = await readFile(filePath, "utf8");
    const currentParsed = parseItemDocument(currentRaw);

    if (currentParsed.version !== payload.version) {
      const error = new Error("El archivo cambió en disco. Recarga antes de guardar.");
      error.code = "VERSION_CONFLICT";
      throw error;
    }

    validateRawMarkdown(payload.rawMarkdown);
    const normalizedMarkdown = payload.rawMarkdown.replaceAll("\r\n", "\n").trimEnd() + "\n";
    await writeFile(filePath, normalizedMarkdown, "utf8");
    return this.readItem(normalizedId);
  }
}
