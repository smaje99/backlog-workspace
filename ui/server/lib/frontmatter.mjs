function stripQuotes(value) {
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll('\\"', '"');
  }

  return value;
}

function parseScalar(rawValue) {
  const value = rawValue.trim();

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (value === "null") {
    return null;
  }

  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return stripQuotes(value);
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function formatScalar(value) {
  if (value === null) {
    return "null";
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }

  const text = String(value);

  if (
    text === "" ||
    /^(true|false|null)$/i.test(text) ||
    /^-?\d+(\.\d+)?$/.test(text) ||
    /[:#[\]{}]|^\s|\s$/.test(text)
  ) {
    return `'${text.replaceAll("'", "''")}'`;
  }

  return text;
}

function parseArray(lines, startIndex) {
  const items = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];
    const match = /^- ?(.*)$/.exec(line);

    if (!match) {
      break;
    }

    const inlineValue = match[1];
    const nextLine = lines[index + 1] ?? "";

    if (/^[^:]+:\s/.test(inlineValue) && /^  [^:]+:\s/.test(nextLine)) {
      const item = {};
      const [firstKey, firstValue] = inlineValue.split(/:\s(.+)/, 2);
      item[firstKey] = parseScalar(firstValue ?? "");
      index += 1;

      while (index < lines.length) {
        const nestedMatch = /^  ([^:]+): ?(.*)$/.exec(lines[index]);
        if (!nestedMatch) {
          break;
        }
        item[nestedMatch[1]] = parseScalar(nestedMatch[2]);
        index += 1;
      }

      items.push(item);
      continue;
    }

    items.push(parseScalar(inlineValue));
    index += 1;
  }

  return { value: items, nextIndex: index };
}

export function splitFrontmatter(rawMarkdown) {
  const normalized = rawMarkdown.replaceAll("\r\n", "\n");

  if (!normalized.startsWith("---\n")) {
    return { frontmatterRaw: "", bodyRaw: normalized };
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);

  if (closingIndex === -1) {
    throw new Error("Frontmatter incompleto.");
  }

  return {
    frontmatterRaw: normalized.slice(4, closingIndex),
    bodyRaw: normalized.slice(closingIndex + 5)
  };
}

export function parseFrontmatter(frontmatterRaw) {
  const lines = frontmatterRaw.split("\n");
  const data = {};
  const order = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const topLevelMatch = /^([A-Za-z0-9_]+): ?(.*)$/.exec(line);
    if (!topLevelMatch) {
      throw new Error(`Línea inválida en frontmatter: ${line}`);
    }

    const [, key, inlineValue] = topLevelMatch;
    order.push(key);
    index += 1;

    if (inlineValue !== "") {
      data[key] = parseScalar(inlineValue);
      continue;
    }

    if (index < lines.length && /^- /.test(lines[index])) {
      const parsed = parseArray(lines, index);
      data[key] = parsed.value;
      index = parsed.nextIndex;
      continue;
    }

    data[key] = "";
  }

  return { data, order };
}

export function stringifyFrontmatter(data, order = Object.keys(data)) {
  const lines = [];

  for (const key of order) {
    const value = data[key];

    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
        continue;
      }

      lines.push(`${key}:`);
      for (const item of value) {
        if (
          item &&
          typeof item === "object" &&
          !Array.isArray(item)
        ) {
          const entries = Object.entries(item);
          const [firstKey, firstValue] = entries[0];
          lines.push(`- ${firstKey}: ${formatScalar(firstValue)}`);
          for (const [nestedKey, nestedValue] of entries.slice(1)) {
            lines.push(`  ${nestedKey}: ${formatScalar(nestedValue)}`);
          }
          continue;
        }

        lines.push(`- ${formatScalar(item)}`);
      }
      continue;
    }

    lines.push(`${key}: ${formatScalar(value)}`);
  }

  return lines.join("\n");
}
