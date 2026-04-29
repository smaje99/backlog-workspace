import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEFAULT_PRIORITY_OPTIONS,
  getAdjacentCanonicalStatus,
  getBoardColumns,
  getStatusLabel,
  orderColumnItems,
  sortPriorityValues
} from "@/lib/status";
import type { ItemSummary, MetaCounts, ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";

type Props = {
  items: ItemSummary[];
  meta: MetaCounts | null;
  selectedId: string | null;
  viewMode: ViewMode;
  pendingItemIds: string[];
  onSelect: (id: string) => void;
  onPriorityChange: (id: string, priority: string) => void;
  onAssigneeChange: (id: string, assignee: string) => void;
  onStatusChange: (id: string, status: string) => void;
};

function statusTone(status: string) {
  if (status === "completed") {
    return "bg-emerald-500/12 text-emerald-300 border-emerald-500/20";
  }
  if (status === "in progress") {
    return "bg-violet-500/12 text-violet-200 border-violet-500/25";
  }
  if (status === "testing") {
    return "bg-amber-500/12 text-amber-200 border-amber-500/25";
  }
  return "bg-sky-500/12 text-sky-200 border-sky-500/20";
}

function sourceSectionLabel(sourceSection: string) {
  const parts = sourceSection
    .split("::")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.at(-1) ?? sourceSection;
}

function sortedOptions(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right, "es"));
}

function buildPriorityOptions(meta: MetaCounts | null, item: ItemSummary) {
  return sortPriorityValues(
    Array.from(
      new Set([...DEFAULT_PRIORITY_OPTIONS, ...Object.keys(meta?.priorities ?? {}), item.priority])
    )
  );
}

function buildAssigneeOptions(meta: MetaCounts | null, item: ItemSummary) {
  return sortedOptions(
    Array.from(
      new Set(
        Object.keys(meta?.assignees ?? {})
          .filter((assignee) => assignee.trim().length > 0)
          .concat(item.assignee ? [item.assignee] : [])
      )
    )
  );
}

function ItemCard({
  item,
  active,
  alwaysShowActions,
  draggable,
  busy,
  meta,
  onSelect,
  onPriorityChange,
  onAssigneeChange,
  onStatusChange,
  onDragStart
}: {
  item: ItemSummary;
  active: boolean;
  alwaysShowActions: boolean;
  draggable: boolean;
  busy: boolean;
  meta: MetaCounts | null;
  onSelect: (id: string) => void;
  onPriorityChange: (id: string, priority: string) => void;
  onAssigneeChange: (id: string, assignee: string) => void;
  onStatusChange: (id: string, status: string) => void;
  onDragStart?: (itemId: string) => void;
}) {
  const previousStatus = getAdjacentCanonicalStatus(item.status, "previous");
  const nextStatus = getAdjacentCanonicalStatus(item.status, "next");
  const priorityOptions = buildPriorityOptions(meta, item);
  const assigneeOptions = buildAssigneeOptions(meta, item);

  return (
    <div
      draggable={draggable && !busy}
      onDragStart={(event) => {
        if (!draggable || busy) {
          return;
        }

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
        onDragStart?.(item.id);
      }}
      className={cn(
        "group rounded-[calc(var(--radius)-4px)] border p-4 transition",
        active
          ? "border-primary bg-primary/10 shadow-[0_18px_50px_-35px_rgba(37,99,235,0.9)]"
          : "border-border/70 bg-background/65 hover:border-primary/40 hover:bg-accent/60",
        draggable && !busy && "cursor-grab active:cursor-grabbing",
        busy && "opacity-75"
      )}
    >
      <button type="button" onClick={() => onSelect(item.id)} className="w-full text-left">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge className={statusTone(item.status)}>
            {getStatusLabel(item.status)}
          </Badge>
          <Badge>{item.priority}</Badge>
          {!item.hasCriterios ? (
            <Badge className="border-amber-500/25 bg-amber-500/12 text-amber-200">
              criterios flojos
            </Badge>
          ) : null}
        </div>
        <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
        <div className="mt-2 max-h-24 overflow-hidden">
          <MarkdownRenderer
            markdown={item.preview || "Sin resumen disponible."}
            className="text-sm leading-6 text-muted-foreground [&_blockquote]:my-2 [&_blockquote]:px-3 [&_blockquote]:py-2 [&_code]:text-[0.9em] [&_h1]:!my-0 [&_h1]:!text-base [&_h2]:!my-0 [&_h2]:!pt-0 [&_h2]:!text-base [&_h3]:!my-0 [&_h3]:!pt-0 [&_h3]:!text-sm [&_h4]:!my-0 [&_h4]:!pt-0 [&_h4]:!text-sm [&_li]:leading-6 [&_ol]:my-1 [&_p]:my-0 [&_pre]:text-xs [&_table]:text-xs [&_ul]:my-1"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{item.assignee || "Sin responsable"}</span>
          <span>•</span>
          <span>{sourceSectionLabel(item.sourceSection)}</span>
        </div>
      </button>

      <div
        className={cn(
          "mt-4 grid gap-2 border-t border-border/60 pt-3 transition",
          alwaysShowActions
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        )}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-[0.16em]">Prioridad</span>
            <select
              value={item.priority}
              disabled={busy}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onPriorityChange(item.id, event.target.value)}
              className="h-9 w-full rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/85 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-[0.16em]">Responsable</span>
            <select
              value={item.assignee}
              disabled={busy}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onAssigneeChange(item.id, event.target.value)}
              className="h-9 w-full rounded-[calc(var(--radius)-6px)] border border-border/70 bg-background/85 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
            >
              <option value="">Sin responsable</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!previousStatus || busy}
            onClick={(event) => {
              event.stopPropagation();
              if (previousStatus) {
                onStatusChange(item.id, previousStatus.id);
              }
            }}
            className="rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
          >
            Estado anterior
          </button>
          <button
            type="button"
            disabled={!nextStatus || busy}
            onClick={(event) => {
              event.stopPropagation();
              if (nextStatus) {
                onStatusChange(item.id, nextStatus.id);
              }
            }}
            className="rounded-full border border-border/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
          >
            Estado siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

export function BacklogBoard({
  items,
  meta,
  selectedId,
  viewMode,
  pendingItemIds,
  onSelect,
  onPriorityChange,
  onAssigneeChange,
  onStatusChange
}: Props) {
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<string | null>(null);
  const pendingSet = new Set(pendingItemIds);

  if (viewMode === "list") {
    return (
      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Lista compacta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              active={item.id === selectedId}
              alwaysShowActions
              draggable={false}
              busy={pendingSet.has(item.id)}
              meta={meta}
              onSelect={onSelect}
              onPriorityChange={onPriorityChange}
              onAssigneeChange={onAssigneeChange}
              onStatusChange={onStatusChange}
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  const columns = getBoardColumns(items);

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {columns.map((column) => {
        const columnItems = orderColumnItems(
          items.filter((item) => item.status === column.id),
          column.id
        );
        const allowDrop = column.canonical;

        return (
          <Card
            key={column.id}
            className={cn(
              "min-h-[24rem] transition",
              dropStatus === column.id && "border-primary/70 shadow-[0_0_0_1px_rgba(15,118,110,0.5)]"
            )}
          >
            <CardHeader className="border-b border-border/70 bg-gradient-to-br from-card via-card to-background/30">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{column.label}</CardTitle>
                <Badge>{columnItems.length}</Badge>
              </div>
            </CardHeader>
            <CardContent
              className={cn(
                "space-y-3 pt-5",
                allowDrop && "min-h-[19rem]"
              )}
              onDragOver={(event) => {
                if (!allowDrop) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropStatus(column.id);
              }}
              onDragLeave={() => {
                if (dropStatus === column.id) {
                  setDropStatus(null);
                }
              }}
              onDrop={(event) => {
                if (!allowDrop) {
                  return;
                }

                event.preventDefault();
                const droppedId = event.dataTransfer.getData("text/plain") || draggedItemId;
                setDropStatus(null);
                setDraggedItemId(null);

                if (!droppedId) {
                  return;
                }

                const droppedItem = items.find((item) => item.id === droppedId);
                if (!droppedItem || droppedItem.status === column.id) {
                  return;
                }

                onStatusChange(droppedId, column.id);
              }}
            >
              {columnItems.length === 0 ? (
                <p className="rounded-[calc(var(--radius)-4px)] border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                  {allowDrop && dropStatus === column.id
                    ? "Suelta aquí para mover la historia."
                    : "No hay historias en esta columna con los filtros actuales."}
                </p>
              ) : (
                columnItems.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    active={item.id === selectedId}
                    alwaysShowActions={false}
                    draggable
                    busy={pendingSet.has(item.id)}
                    meta={meta}
                    onSelect={onSelect}
                    onPriorityChange={onPriorityChange}
                    onAssigneeChange={onAssigneeChange}
                    onStatusChange={onStatusChange}
                    onDragStart={setDraggedItemId}
                  />
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
