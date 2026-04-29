import type { ItemSummary } from "@/lib/types";

export const STATUS_COLUMNS = [
  { id: "backlog", label: "Backlog" },
  { id: "in progress", label: "In progress" },
  { id: "testing", label: "Testing" },
  { id: "completed", label: "Completado" }
] as const;

export const STATUS_LABELS = Object.fromEntries(
  STATUS_COLUMNS.map((column) => [column.id, column.label])
) as Record<string, string>;

export const CANONICAL_STATUS_IDS = STATUS_COLUMNS.map((column) => column.id);
const PRIORITY_SORTED_STATUS_IDS = new Set(["backlog", "in progress", "testing"]);
export const DEFAULT_PRIORITY_OPTIONS = ["p0", "p1", "high", "medium", "low"] as const;
const PRIORITY_WEIGHTS = new Map<string, number>([
  ["p0", 1000],
  ["p1", 900],
  ["high", 700],
  ["medium", 500],
  ["low", 100]
]);

export function getStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function isCanonicalStatus(status: string) {
  return CANONICAL_STATUS_IDS.some((value) => value === status);
}

export function getAdjacentCanonicalStatus(
  status: string,
  direction: "previous" | "next"
) {
  const index = STATUS_COLUMNS.findIndex((column) => column.id === status);
  if (index === -1) {
    return null;
  }

  const offset = direction === "previous" ? -1 : 1;
  return STATUS_COLUMNS[index + offset] ?? null;
}

export function getBoardColumns(items: ItemSummary[]) {
  const seen = new Set<string>();
  const unknownStatuses = items
    .map((item) => item.status)
    .filter((status) => {
      if (isCanonicalStatus(status) || seen.has(status)) {
        return false;
      }

      seen.add(status);
      return true;
    })
    .map((status) => ({
      id: status,
      label: getStatusLabel(status),
      canonical: false as const
    }));

  return [
    ...STATUS_COLUMNS.map((column) => ({ ...column, canonical: true as const })),
    ...unknownStatuses
  ];
}

function getPriorityWeight(priority: string) {
  const normalized = priority.trim().toLowerCase();
  const explicitWeight = PRIORITY_WEIGHTS.get(normalized);

  if (explicitWeight !== undefined) {
    return explicitWeight;
  }

  const prefixedMatch = normalized.match(/^p(\d+)$/);
  if (prefixedMatch) {
    return 1000 - Number(prefixedMatch[1]);
  }

  const numericValue = Number(normalized);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  return 0;
}

export function comparePriorityValuesDesc(left: string, right: string) {
  const weightDifference = getPriorityWeight(right) - getPriorityWeight(left);

  if (weightDifference !== 0) {
    return weightDifference;
  }

  return left.localeCompare(right, "es");
}

export function sortPriorityValues(values: string[]) {
  return [...values].sort(comparePriorityValuesDesc);
}

export function compareItemsByPriorityDesc(left: ItemSummary, right: ItemSummary) {
  const priorityDifference =
    getPriorityWeight(right.priority) - getPriorityWeight(left.priority);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const createdAtDifference =
    Date.parse(right.createdAt || "") - Date.parse(left.createdAt || "");

  if (Number.isFinite(createdAtDifference) && createdAtDifference !== 0) {
    return createdAtDifference;
  }

  const titleDifference = left.title.localeCompare(right.title, "es");
  if (titleDifference !== 0) {
    return titleDifference;
  }

  return left.id.localeCompare(right.id, "es");
}

export function orderColumnItems(items: ItemSummary[], status: string) {
  if (!PRIORITY_SORTED_STATUS_IDS.has(status)) {
    return items;
  }

  return [...items].sort(compareItemsByPriorityDesc);
}

export function orderItemsForKanban(items: ItemSummary[]) {
  const groups = new Map<string, ItemSummary[]>();

  for (const item of items) {
    const bucket = groups.get(item.status);
    if (bucket) {
      bucket.push(item);
      continue;
    }
    groups.set(item.status, [item]);
  }

  const ordered = STATUS_COLUMNS.flatMap((column) =>
    orderColumnItems(groups.get(column.id) ?? [], column.id)
  );
  const knownStatuses = new Set<string>(CANONICAL_STATUS_IDS);
  const unknown = items.filter((item) => !knownStatuses.has(item.status));

  return [...ordered, ...unknown];
}
