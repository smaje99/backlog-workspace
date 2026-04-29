import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState
} from "react";
import { toast } from "sonner";

import { BacklogBoard } from "@/components/backlog-board";
import { BacklogFilters } from "@/components/backlog-filters";
import {
  ItemDetail,
  type ItemDetailHandle
} from "@/components/item-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchItem, fetchItems, fetchMeta, saveStructuredItem } from "@/lib/api";
import {
  CANONICAL_STATUS_IDS,
  getStatusLabel,
  orderItemsForKanban
} from "@/lib/status";
import type {
  BacklogItem,
  FilterState,
  ItemSummary,
  MetaCounts,
  QuickFilterKey,
  Sections,
  ViewMode
} from "@/lib/types";

const EMPTY_FILTERS: FilterState = {
  search: "",
  statuses: [],
  priority: "",
  assignee: "",
  tag: "",
  quickFilter: ""
};

type StructuredPatch = Partial<
  Pick<BacklogItem, "title" | "status" | "priority" | "assignee" | "tags" | "sections">
>;

function hasMeaningfulCriterios(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  const nonEmptyLines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return nonEmptyLines.length >= 2 || normalized.length >= 40;
}

function buildPreview(sections: Sections) {
  return (sections.historia || sections.criterios || "")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function summarizeItem(item: BacklogItem): ItemSummary {
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

function patchSummary(item: ItemSummary, patch: StructuredPatch): ItemSummary {
  const nextAssignee = patch.assignee ?? item.assignee;
  const nextTags = patch.tags ?? item.tags;
  const nextSections = patch.sections;

  return {
    ...item,
    title: patch.title ?? item.title,
    status: patch.status ?? item.status,
    priority: patch.priority ?? item.priority,
    assignee: nextAssignee,
    hasAssignee: nextAssignee.trim().length > 0,
    tags: nextTags,
    hasTags: nextTags.length > 0,
    hasCriterios: nextSections
      ? hasMeaningfulCriterios(nextSections.criterios)
      : item.hasCriterios,
    preview: nextSections ? buildPreview(nextSections) : item.preview
  };
}

function patchBacklogItem(item: BacklogItem, patch: StructuredPatch): BacklogItem {
  const nextSections = patch.sections ?? item.sections;
  const nextAssignee = patch.assignee ?? item.assignee;
  const nextTags = patch.tags ?? item.tags;

  return {
    ...item,
    title: patch.title ?? item.title,
    status: patch.status ?? item.status,
    priority: patch.priority ?? item.priority,
    assignee: nextAssignee,
    hasAssignee: nextAssignee.trim().length > 0,
    tags: nextTags,
    hasTags: nextTags.length > 0,
    sections: nextSections,
    hasCriterios: hasMeaningfulCriterios(nextSections.criterios),
    preview: buildPreview(nextSections)
  };
}

function applyQuickFilter(items: ItemSummary[], quickFilter: QuickFilterKey) {
  if (quickFilter === "unassigned") {
    return items.filter((item) => !item.hasAssignee);
  }

  if (quickFilter === "untagged") {
    return items.filter((item) => !item.hasTags);
  }

  if (quickFilter === "missing-criteria") {
    return items.filter((item) => !item.hasCriterios);
  }

  return items;
}

function matchesVisibleFilters(item: ItemSummary, filters: FilterState) {
  if (filters.statuses.length > 0 && !filters.statuses.includes(item.status)) {
    return false;
  }

  if (filters.priority && item.priority !== filters.priority) {
    return false;
  }

  if (filters.assignee && item.assignee !== filters.assignee) {
    return false;
  }

  if (filters.tag && !item.tags.includes(filters.tag)) {
    return false;
  }

  return applyQuickFilter([item], filters.quickFilter).length > 0;
}

function readFiltersFromUrl(): FilterState {
  if (typeof window === "undefined") {
    return EMPTY_FILTERS;
  }

  const params = new URLSearchParams(window.location.search);
  const statuses = params
    .getAll("status")
    .map((value) => value.trim())
    .filter((value) => CANONICAL_STATUS_IDS.some((status) => status === value));

  return {
    ...EMPTY_FILTERS,
    search: params.get("q")?.trim() ?? "",
    statuses: Array.from(new Set(statuses)),
    priority: params.get("priority")?.trim() ?? "",
    assignee: params.get("assignee")?.trim() ?? "",
    tag: params.get("tag")?.trim() ?? ""
  };
}

function readViewModeFromUrl(): ViewMode {
  if (typeof window === "undefined") {
    return "board";
  }

  return window.location.search.includes("view=list") ? "list" : "board";
}

function sameFilters(left: FilterState, right: FilterState) {
  return (
    left.search === right.search &&
    left.priority === right.priority &&
    left.assignee === right.assignee &&
    left.tag === right.tag &&
    left.quickFilter === right.quickFilter &&
    left.statuses.length === right.statuses.length &&
    left.statuses.every((status, index) => status === right.statuses[index])
  );
}

function sanitizeFilters(filters: FilterState, meta: MetaCounts | null) {
  if (!meta) {
    return filters;
  }

  const validStatuses = new Set([
    ...CANONICAL_STATUS_IDS,
    ...Object.keys(meta.statuses ?? {})
  ]);
  const nextFilters = {
    ...filters,
    statuses: filters.statuses.filter((status) => validStatuses.has(status))
  };

  if (nextFilters.priority && !(nextFilters.priority in (meta.priorities ?? {}))) {
    nextFilters.priority = "";
  }

  if (nextFilters.assignee && !(nextFilters.assignee in (meta.assignees ?? {}))) {
    nextFilters.assignee = "";
  }

  if (nextFilters.tag && !(nextFilters.tag in (meta.tags ?? {}))) {
    nextFilters.tag = "";
  }

  return nextFilters;
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable ||
    !!target.closest("[contenteditable='true']")
  );
}

function buildRefreshFilters(filters: FilterState, deferredSearch: string): FilterState {
  return {
    ...filters,
    search: deferredSearch
  };
}

type RefreshItemsOptions = {
  silent?: boolean;
};

export default function App() {
  const [filters, setFilters] = useState<FilterState>(() => readFiltersFromUrl());
  const [items, setItems] = useState<ItemSummary[]>([]);
  const [meta, setMeta] = useState<MetaCounts | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewModeFromUrl());
  const [listLoading, setListLoading] = useState(true);
  const [itemLoading, setItemLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
  const detailRef = useRef<ItemDetailHandle | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(filters.search);

  async function refreshMeta() {
    try {
      setMeta(await fetchMeta());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No fue posible cargar la meta.";
      setListError(message);
      toast.error(message);
    }
  }

  async function refreshItems(
    nextFilters: FilterState,
    options: RefreshItemsOptions = {}
  ) {
    const silent = options.silent ?? false;

    if (!silent) {
      setListLoading(true);
    }
    setListError(null);

    try {
      const nextItems = await fetchItems(nextFilters);
      setItems(applyQuickFilter(nextItems, nextFilters.quickFilter));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No fue posible cargar el backlog.";
      setListError(message);
      toast.error(message);
    } finally {
      if (!silent) {
        setListLoading(false);
      }
    }
  }

  function markPending(id: string, active: boolean) {
    setPendingItemIds((current) => {
      if (active) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((value) => value !== id);
    });
  }

  async function syncItem(updated: BacklogItem) {
    startTransition(() => {
      setSelectedId(updated.id);
      setSelectedItem(updated);
    });
    setItems((current) =>
      current.map((item) => (item.id === updated.id ? summarizeItem(updated) : item))
    );
    await Promise.all([
      refreshMeta(),
      refreshItems(buildRefreshFilters(filters, deferredSearch), { silent: true })
    ]);
  }

  async function mutateStructuredItem(
    id: string,
    patch: StructuredPatch,
    successMessage: string
  ) {
    const previousSummary = items.find((item) => item.id === id) ?? null;
    const previousDetail = selectedItem?.id === id ? selectedItem : null;

    if (previousSummary) {
      setItems((current) =>
        current.flatMap((item) => {
          if (item.id !== id) {
            return [item];
          }

          const updated = patchSummary(item, patch);
          return matchesVisibleFilters(updated, filters) ? [updated] : [];
        })
      );
    }

    if (previousDetail) {
      setSelectedItem(patchBacklogItem(previousDetail, patch));
    }

    markPending(id, true);

    try {
      const baseItem = previousDetail ?? (await fetchItem(id));
      const updated = await saveStructuredItem(id, {
        version: baseItem.version,
        title: patch.title ?? baseItem.title,
        status: patch.status ?? baseItem.status,
        priority: patch.priority ?? baseItem.priority,
        assignee: patch.assignee ?? baseItem.assignee,
        tags: patch.tags ?? baseItem.tags,
        sections: patch.sections ?? baseItem.sections
      });

      setItems((current) =>
        current.flatMap((item) => {
          if (item.id !== id) {
            return [item];
          }

          const updatedSummary = summarizeItem(updated);
          return matchesVisibleFilters(updatedSummary, filters) ? [updatedSummary] : [];
        })
      );
      setSelectedItem((current) => (current?.id === id ? updated : current));
      toast.success(successMessage);
      await refreshMeta();
    } catch (error) {
      if (previousSummary) {
        setItems((current) =>
          current.map((item) => (item.id === id ? previousSummary : item))
        );
      }

      if (previousDetail) {
        setSelectedItem(previousDetail);
      }

      toast.error(
        error instanceof Error ? error.message : "No fue posible guardar el cambio rápido."
      );
    } finally {
      markPending(id, false);
    }
  }

  function selectRelative(offset: -1 | 1) {
    const visibleItems = orderItemsForKanban(items);
    if (visibleItems.length === 0) {
      return;
    }

    if (selectedId && !detailRef.current?.canLeaveCurrentItem()) {
      return;
    }

    const currentIndex = selectedId
      ? visibleItems.findIndex((item) => item.id === selectedId)
      : -1;
    const fallbackIndex = offset > 0 ? 0 : visibleItems.length - 1;
    const nextIndex =
      currentIndex === -1
        ? fallbackIndex
        : Math.max(0, Math.min(visibleItems.length - 1, currentIndex + offset));

    if (currentIndex === nextIndex) {
      return;
    }

    startTransition(() => setSelectedId(visibleItems[nextIndex].id));
  }

  useEffect(() => {
    void refreshMeta();
  }, []);

  useEffect(() => {
    const nextFilters = buildRefreshFilters(filters, deferredSearch);
    void refreshItems(nextFilters);
  }, [
    deferredSearch,
    filters.statuses,
    filters.priority,
    filters.assignee,
    filters.tag,
    filters.quickFilter
  ]);

  useEffect(() => {
    if (!meta) {
      return;
    }

    const nextFilters = sanitizeFilters(filters, meta);
    if (!sameFilters(nextFilters, filters)) {
      setFilters(nextFilters);
    }
  }, [filters, meta]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    url.searchParams.delete("status");
    url.searchParams.delete("priority");
    url.searchParams.delete("assignee");
    url.searchParams.delete("tag");
    url.searchParams.delete("view");

    if (filters.search.trim()) {
      url.searchParams.set("q", filters.search.trim());
    }

    for (const status of filters.statuses) {
      url.searchParams.append("status", status);
    }

    if (filters.priority) {
      url.searchParams.set("priority", filters.priority);
    }

    if (filters.assignee) {
      url.searchParams.set("assignee", filters.assignee);
    }

    if (filters.tag) {
      url.searchParams.set("tag", filters.tag);
    }

    url.searchParams.set("view", viewMode);
    window.history.replaceState({}, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [filters.assignee, filters.priority, filters.search, filters.statuses, filters.tag, viewMode]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedItem(null);
      setItemLoading(false);
      return;
    }

    let cancelled = false;
    setItemLoading(true);

    fetchItem(selectedId)
      .then((item) => {
        if (!cancelled) {
          setSelectedItem(item);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSelectedItem(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setItemLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTextEditingTarget(event.target)
      ) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (event.key === "g") {
        event.preventDefault();
        setViewMode((current) => (current === "board" ? "list" : "board"));
        return;
      }

      if (event.key === "j") {
        event.preventDefault();
        selectRelative(1);
        return;
      }

      if (event.key === "k") {
        event.preventDefault();
        selectRelative(-1);
        return;
      }

      if (!selectedId) {
        return;
      }

      if (event.key === "e") {
        event.preventDefault();
        detailRef.current?.openStructuredEditor();
        return;
      }

      if (event.key === "[") {
        event.preventDefault();
        detailRef.current?.moveStatus("previous");
        return;
      }

      if (event.key === "]") {
        event.preventDefault();
        detailRef.current?.moveStatus("next");
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        detailRef.current?.handleEscape();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items, selectedId]);

  const relatedItems = Object.fromEntries(items.map((item) => [item.id, item]));
  const navigableItems = orderItemsForKanban(items);
  const selectedOutsideFilter =
    !!selectedItem && !items.some((item) => item.id === selectedItem.id);

  const quickActions = [
    {
      id: "unassigned",
      label: "Sin responsable",
      description: "Resalta historias sin asignación para repartir trabajo.",
      active: filters.quickFilter === "unassigned",
      onClick: () => setFilters({ ...EMPTY_FILTERS, quickFilter: "unassigned" })
    },
    {
      id: "untagged",
      label: "Sin tags",
      description: "Encuentra historias que aún no están clasificadas.",
      active: filters.quickFilter === "untagged",
      onClick: () => setFilters({ ...EMPTY_FILTERS, quickFilter: "untagged" })
    },
    {
      id: "testing",
      label: "En testing",
      description: "Abre de inmediato el tramo final antes de completar.",
      active: filters.statuses.length === 1 && filters.statuses[0] === "testing",
      onClick: () => setFilters({ ...EMPTY_FILTERS, statuses: ["testing"] })
    },
    {
      id: "p0",
      label: "Prioridad p0",
      description: "Aísla lo urgente sin tocar el resto del backlog.",
      active: filters.priority === "p0",
      onClick: () => setFilters({ ...EMPTY_FILTERS, priority: "p0" })
    },
    {
      id: "p1",
      label: "Prioridad p1",
      description: "Agrupa el siguiente bloque de trabajo importante.",
      active: filters.priority === "p1",
      onClick: () => setFilters({ ...EMPTY_FILTERS, priority: "p1" })
    },
    {
      id: "missing-criteria",
      label: "Criterios vacíos o mínimos",
      description: "Marca historias con criterios débiles para completarlas.",
      active: filters.quickFilter === "missing-criteria",
      onClick: () => setFilters({ ...EMPTY_FILTERS, quickFilter: "missing-criteria" })
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1700px] flex-col gap-6 px-4 py-6 lg:px-6">
        <header className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <Card className="overflow-hidden">
            <CardContent className="relative p-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.18),transparent_40%)]" />
              <div className="relative flex min-h-40 flex-col justify-end gap-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground">
                  Epicrisis IA - CIDTI - Backlog
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Interfaz local para navegar, priorizar y actualizar las historias
                  de usuario del proyecto directamente desde los archivos
                  <code className="mx-1 rounded bg-background/70 px-1.5 py-0.5 text-[0.92em] text-foreground">
                    REQ*.md
                  </code>
                  del repositorio.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Vista de trabajo
                </p>
                <div className="inline-flex rounded-full border border-border/70 bg-background/80 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("board")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      viewMode === "board"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    Tablero
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      viewMode === "list"
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    Lista
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => void refreshMeta()}>
                  Refrescar meta
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    void refreshItems(buildRefreshFilters(filters, deferredSearch))
                  }
                >
                  Refrescar backlog
                </Button>
              </div>
            </CardContent>
          </Card>
        </header>

        <main className="backlog-main grid gap-6">
          <input
            id="backlog-filters-mobile-toggle"
            type="checkbox"
            className="backlog-filters-mobile-toggle sr-only"
            aria-controls="backlog-filters-panel"
          />
          <input
            id="backlog-filters-desktop-toggle"
            type="checkbox"
            className="backlog-filters-desktop-toggle sr-only"
            aria-controls="backlog-filters-panel"
            defaultChecked
          />
          <aside id="backlog-filters-panel" className="backlog-filters-panel">
            <BacklogFilters
              filters={filters}
              meta={meta}
              visibleCount={items.length}
              quickFilter={filters.quickFilter}
              quickActions={quickActions}
              searchInputRef={searchInputRef}
              onChange={setFilters}
              onReset={() => setFilters(EMPTY_FILTERS)}
            />
          </aside>

          <section className="space-y-4">
            <label
              htmlFor="backlog-filters-mobile-toggle"
              className="backlog-filters-mobile-trigger backlog-filters-mobile-trigger-closed inline-flex cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent xl:hidden"
            >
              Mostrar filtros
            </label>
            <label
              htmlFor="backlog-filters-mobile-toggle"
              className="backlog-filters-mobile-trigger backlog-filters-mobile-trigger-open hidden cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent xl:hidden"
            >
              Ocultar filtros
            </label>
            <label
              htmlFor="backlog-filters-desktop-toggle"
              className="backlog-filters-desktop-trigger backlog-filters-desktop-trigger-closed hidden cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent xl:inline-flex"
            >
              Mostrar filtros
            </label>
            <label
              htmlFor="backlog-filters-desktop-toggle"
              className="backlog-filters-desktop-trigger backlog-filters-desktop-trigger-open hidden cursor-pointer items-center justify-center rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent xl:inline-flex"
            >
              Ocultar filtros
            </label>
            {listError ? (
              <Card>
                <CardContent className="p-6 text-sm text-rose-200">
                  {listError}
                </CardContent>
              </Card>
            ) : null}
            {listLoading ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Cargando backlog…
                </CardContent>
              </Card>
            ) : (
              <BacklogBoard
                items={items}
                meta={meta}
                selectedId={selectedId}
                viewMode={viewMode}
                pendingItemIds={pendingItemIds}
                onSelect={(id) => startTransition(() => setSelectedId(id))}
                onPriorityChange={(id, priority) =>
                  void mutateStructuredItem(id, { priority }, `Prioridad actualizada a ${priority}.`)
                }
                onAssigneeChange={(id, assignee) =>
                  void mutateStructuredItem(
                    id,
                    { assignee },
                    assignee
                      ? `Responsable actualizado a ${assignee}.`
                      : "Responsable removido."
                  )
                }
                onStatusChange={(id, status) =>
                  void mutateStructuredItem(
                    id,
                    { status },
                    `Estado actualizado a ${getStatusLabel(status)}.`
                  )
                }
              />
            )}
          </section>
        </main>
      </div>

      <ItemDetail
        ref={detailRef}
        open={!!selectedId}
        item={selectedItem}
        loading={itemLoading}
        meta={meta}
        relatedItems={relatedItems}
        navigableItems={navigableItems}
        selectedOutsideFilter={selectedOutsideFilter}
        onClose={() => startTransition(() => setSelectedId(null))}
        onSelectLink={(id) => startTransition(() => setSelectedId(id))}
        onItemSync={syncItem}
      />
    </div>
  );
}
