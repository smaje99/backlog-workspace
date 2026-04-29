import type {
  BacklogItem,
  FilterState,
  ItemSummary,
  MetaCounts,
  StructuredSavePayload
} from "@/lib/types";

async function request<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "No fue posible completar la operación.");
  }

  return (await response.json()) as T;
}

export async function fetchItems(filters: FilterState) {
  const params = new URLSearchParams();

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  for (const status of filters.statuses) {
    params.append("status", status);
  }

  if (filters.priority) {
    params.set("priority", filters.priority);
  }

  if (filters.assignee) {
    params.set("assignee", filters.assignee);
  }

  if (filters.tag) {
    params.set("tag", filters.tag);
  }

  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request<ItemSummary[]>(`/api/items${suffix}`);
}

export async function fetchItem(id: string) {
  return request<BacklogItem>(`/api/items/${id}`);
}

export async function fetchMeta() {
  return request<MetaCounts>("/api/meta");
}

export async function saveStructuredItem(
  id: string,
  payload: StructuredSavePayload
) {
  return request<BacklogItem>(`/api/items/${id}/structured`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}

export async function saveRawItem(
  id: string,
  payload: { version: string; rawMarkdown: string }
) {
  return request<BacklogItem>(`/api/items/${id}/raw`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}
