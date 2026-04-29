import { createHash } from "node:crypto";

import {
  KNOWN_PRIORITIES,
  SECTION_DEFINITIONS
} from "./constants.mjs";
import {
  parseFrontmatter,
  splitFrontmatter,
  stringifyFrontmatter
} from "./frontmatter.mjs";

function normalizeSectionName(value) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function toCanonicalSectionKey(heading) {
  const normalized = normalizeSectionName(heading);

  if (normalized === "historia") {
    return "historia";
  }

  if (normalized === "alcance") {
    return "alcance";
  }

  if (normalized === "criterios de aceptacion") {
    return "criterios";
  }

  if (normalized === "notas tecnicas") {
    return "notas";
  }

  if (normalized === "observaciones") {
    return "observaciones";
  }

  return null;
}

function extractTitle(bodyRaw) {
  const match = /^#\s+(.+)$/m.exec(bodyRaw);
  if (!match) {
    throw new Error("No se encontró el título H1 del ítem.");
  }

  return {
    title: match[1].trim(),
    matchIndex: match.index,
    matchLength: match[0].length
  };
}

function parseSections(bodyWithoutTitle) {
  const sections = [];
  const sectionMatches = [...bodyWithoutTitle.matchAll(/^##\s+(.+)$/gm)];

  for (let index = 0; index < sectionMatches.length; index += 1) {
    const match = sectionMatches[index];
    const heading = match[1].trim();
    const contentStart = match.index + match[0].length;
    const nextMatch = sectionMatches[index + 1];
    const contentEnd = nextMatch ? nextMatch.index : bodyWithoutTitle.length;
    const content = bodyWithoutTitle
      .slice(contentStart, contentEnd)
      .replace(/^\n+/, "")
      .replace(/\n+$/, "");

    sections.push({
      heading,
      key: toCanonicalSectionKey(heading),
      content
    });
  }

  return sections;
}

function buildSectionsMap(sections) {
  const mapped = {
    historia: "",
    alcance: "",
    criterios: "",
    notas: "",
    observaciones: ""
  };

  for (const section of sections) {
    if (section.key) {
      mapped[section.key] = section.content;
    }
  }

  return mapped;
}

function ensureOrder(order, key) {
  if (!order.includes(key)) {
    order.push(key);
  }
}

function coerceLinks(rawLinks) {
  if (!Array.isArray(rawLinks)) {
    return [];
  }

  return rawLinks
    .map((entry) => {
      if (typeof entry === "string") {
        const [id] = entry.split(":");
        return { id: id.trim(), raw: entry };
      }
      return null;
    })
    .filter(Boolean);
}

function coerceReferences(rawReferences) {
  if (!Array.isArray(rawReferences)) {
    return [];
  }

  return rawReferences.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof entry.path === "string"
  );
}

function hasMeaningfulCriteria(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return false;
  }

  const nonEmptyLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return nonEmptyLines.length >= 2 || normalized.length >= 40;
}

export function computeVersion(rawMarkdown) {
  return createHash("sha256").update(rawMarkdown).digest("hex");
}

export function parseItemDocument(rawMarkdown) {
  const { frontmatterRaw, bodyRaw } = splitFrontmatter(rawMarkdown);
  const { data: frontmatter, order } = parseFrontmatter(frontmatterRaw);
  const { title, matchIndex, matchLength } = extractTitle(bodyRaw);
  const afterTitle = bodyRaw.slice(matchIndex + matchLength).replace(/^\n+/, "");
  const sections = parseSections(afterTitle);
  const sectionsMap = buildSectionsMap(sections);

  return {
    frontmatter,
    frontmatterOrder: order,
    title,
    sections,
    sectionsMap,
    rawMarkdown: rawMarkdown.replaceAll("\r\n", "\n"),
    version: computeVersion(rawMarkdown),
    h1Offset: matchIndex
  };
}

export function validateStructuredInput(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("La carga estructurada es inválida.");
  }

  if (!payload.version || typeof payload.version !== "string") {
    throw new Error("La versión del archivo es obligatoria.");
  }

  if (!payload.title || typeof payload.title !== "string" || !payload.title.trim()) {
    throw new Error("El título es obligatorio.");
  }

  if (typeof payload.status !== "string" || !payload.status.trim()) {
    throw new Error("El estado es obligatorio.");
  }

  if (!KNOWN_PRIORITIES.includes(payload.priority)) {
    throw new Error(`Prioridad desconocida: ${payload.priority}`);
  }

  if (!payload.sections || typeof payload.sections !== "object") {
    throw new Error("Las secciones estructuradas son obligatorias.");
  }

  for (const section of SECTION_DEFINITIONS) {
    const value = String(payload.sections[section.key] ?? "").trim();
    if (section.required && !value) {
      throw new Error(`La sección "${section.heading}" no puede estar vacía.`);
    }
  }
}

export function validateRawMarkdown(rawMarkdown) {
  if (typeof rawMarkdown !== "string" || !rawMarkdown.trim()) {
    throw new Error("El Markdown completo no puede estar vacío.");
  }

  const parsed = parseItemDocument(rawMarkdown);
  validateStructuredInput({
    version: parsed.version,
    title: parsed.title,
    status: String(parsed.frontmatter.status ?? ""),
    priority: String(parsed.frontmatter.priority ?? ""),
    sections: parsed.sectionsMap
  });

  return parsed;
}

export function serializeItemDocument(document) {
  const frontmatter = stringifyFrontmatter(
    document.frontmatter,
    document.frontmatterOrder
  );
  const bodyParts = [`# ${document.title}`];

  for (const section of document.sections) {
    bodyParts.push(`## ${section.heading}`);
    bodyParts.push(section.content.trimEnd());
  }

  return `---\n${frontmatter}\n---\n\n${bodyParts.join("\n\n").trimEnd()}\n`;
}

export function buildStructuredMarkdown(parsed, payload) {
  validateStructuredInput(payload);

  const frontmatter = { ...parsed.frontmatter };
  const frontmatterOrder = [...parsed.frontmatterOrder];
  frontmatter.status = payload.status;
  frontmatter.priority = payload.priority;
  frontmatter.assignee = String(payload.assignee ?? "").trim();
  frontmatter.tags = Array.isArray(payload.tags)
    ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  ensureOrder(frontmatterOrder, "assignee");
  ensureOrder(frontmatterOrder, "priority");
  ensureOrder(frontmatterOrder, "status");
  ensureOrder(frontmatterOrder, "tags");

  const sections = parsed.sections.map((section) => ({ ...section }));

  for (const definition of SECTION_DEFINITIONS) {
    const nextContent = String(payload.sections[definition.key] ?? "").trim();
    const existing = sections.find((section) => section.key === definition.key);

    if (existing) {
      existing.content = nextContent;
      continue;
    }

    if (!nextContent && !definition.required) {
      continue;
    }

    const observacionesIndex = sections.findIndex(
      (section) => section.key === "observaciones"
    );
    const sectionToInsert = {
      heading: definition.heading,
      key: definition.key,
      content: nextContent
    };

    if (definition.key === "observaciones" || observacionesIndex === -1) {
      sections.push(sectionToInsert);
    } else {
      sections.splice(observacionesIndex, 0, sectionToInsert);
    }
  }

  return serializeItemDocument({
    frontmatter,
    frontmatterOrder,
    title: payload.title.trim(),
    sections
  });
}

export function toItemEntity(id, parsed, relativePath) {
  const links = coerceLinks(parsed.frontmatter.links);
  const references = coerceReferences(parsed.frontmatter.references);
  const title = parsed.title;
  const sections = parsed.sectionsMap;

  return {
    id,
    path: relativePath,
    title,
    status: String(parsed.frontmatter.status ?? ""),
    priority: String(parsed.frontmatter.priority ?? ""),
    assignee: String(parsed.frontmatter.assignee ?? ""),
    hasAssignee: String(parsed.frontmatter.assignee ?? "").trim().length > 0,
    createdAt: String(parsed.frontmatter.created_at ?? ""),
    sourceSection: String(parsed.frontmatter.source_section ?? ""),
    tags: Array.isArray(parsed.frontmatter.tags)
      ? parsed.frontmatter.tags.map((tag) => String(tag))
      : [],
    hasTags: Array.isArray(parsed.frontmatter.tags) && parsed.frontmatter.tags.length > 0,
    hasCriterios: hasMeaningfulCriteria(sections.criterios),
    links,
    references,
    sections,
    rawMarkdown: parsed.rawMarkdown,
    version: parsed.version,
    preview: (sections.historia || sections.criterios || "")
      .replaceAll(/\s+/g, " ")
      .trim()
      .slice(0, 180)
  };
}
