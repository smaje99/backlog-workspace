import type { RefObject } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_PRIORITY_OPTIONS,
  STATUS_COLUMNS,
  getStatusLabel,
  sortPriorityValues
} from "@/lib/status";
import type { FilterState, MetaCounts, QuickFilterKey } from "@/lib/types";
import { cn } from "@/lib/utils";

type QuickAction = {
  id: string;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
};

type Props = {
  filters: FilterState;
  meta: MetaCounts | null;
  visibleCount: number;
  quickFilter: QuickFilterKey;
  quickActions: QuickAction[];
  searchInputRef: RefObject<HTMLInputElement | null>;
  onChange: (next: FilterState) => void;
  onReset: () => void;
};

function sortedEntries(record: Record<string, number> | undefined) {
  return Object.entries(record ?? {})
    .filter(([key]) => key.trim().length > 0)
    .sort((left, right) => left[0].localeCompare(right[0], "es"));
}

function quickFilterLabel(quickFilter: QuickFilterKey) {
  if (quickFilter === "unassigned") {
    return "Sin responsable";
  }

  if (quickFilter === "untagged") {
    return "Sin tags";
  }

  if (quickFilter === "missing-criteria") {
    return "Criterios vacíos o mínimos";
  }

  return null;
}

export function BacklogFilters({
  filters,
  meta,
  visibleCount,
  quickFilter,
  quickActions,
  searchInputRef,
  onChange,
  onReset
}: Props) {
  const toggleStatus = (status: string) => {
    const active = filters.statuses.includes(status);
    const nextStatuses = active
      ? filters.statuses.filter((value) => value !== status)
      : [...filters.statuses, status];

    onChange({ ...filters, statuses: nextStatuses });
  };

  const activeQuickFilterLabel = quickFilterLabel(quickFilter);
  const priorityOptions = sortPriorityValues(
    Array.from(new Set([...DEFAULT_PRIORITY_OPTIONS, ...Object.keys(meta?.priorities ?? {})]))
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/70 bg-gradient-to-br from-card via-card to-card/40">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <Badge>Fuente viva</Badge>
            <CardTitle>Filtros del backlog</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onReset}>
            Limpiar
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {visibleCount} de {meta?.total ?? 0} historias visibles.
        </p>
        {activeQuickFilterLabel ? (
          <p className="text-xs font-medium text-emerald-200">
            Acción activa: {activeQuickFilterLabel}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Buscar
          </label>
          <Input
            ref={searchInputRef}
            value={filters.search}
            placeholder="Texto, tag, criterio o responsable"
            onChange={(event) =>
              onChange({ ...filters, search: event.target.value })
            }
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Estado
          </label>
          <div className="flex flex-wrap gap-2">
            {STATUS_COLUMNS.map((column) => {
              const count = meta?.statuses[column.id] ?? 0;
              return (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => toggleStatus(column.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition",
                    filters.statuses.includes(column.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-background/70 text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span>{getStatusLabel(column.id)}</span>
                  <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px]">
                    {count}
                  </span>
                </button>
              );
            })}
            {sortedEntries(meta?.statuses)
              .filter(([status]) => !STATUS_COLUMNS.some((column) => column.id === status))
              .map(([status, count]) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition",
                    filters.statuses.includes(status)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/70 bg-background/70 text-muted-foreground hover:bg-accent"
                  )}
                >
                  <span>{getStatusLabel(status)}</span>
                  <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px]">
                    {count}
                  </span>
                </button>
              ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Prioridad
            </label>
            <select
              value={filters.priority}
              onChange={(event) =>
                onChange({ ...filters, priority: event.target.value })
              }
              className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/80 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
            >
              <option value="">Todas</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority} ({meta?.priorities?.[priority] ?? 0})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Responsable
            </label>
            <select
              value={filters.assignee}
              onChange={(event) =>
                onChange({ ...filters, assignee: event.target.value })
              }
              className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/80 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
            >
              <option value="">Todos</option>
              {sortedEntries(meta?.assignees).map(([assignee, count]) => (
                <option key={assignee} value={assignee}>
                  {assignee} ({count})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Tag
          </label>
          <select
            value={filters.tag}
            onChange={(event) => onChange({ ...filters, tag: event.target.value })}
            className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/80 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-4 focus:ring-ring/15"
          >
            <option value="">Todos</option>
            {sortedEntries(meta?.tags).map(([tag, count]) => (
              <option key={tag} value={tag}>
                {tag} ({count})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 rounded-[calc(var(--radius)-4px)] border border-border/70 bg-background/45 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Próximas acciones
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Atajos rápidos para encontrar huecos operativos sin abrir una vista
              paralela.
            </p>
          </div>
          <div className="grid gap-2">
            {quickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={action.onClick}
                className={cn(
                  "rounded-[calc(var(--radius)-6px)] border px-3 py-3 text-left transition",
                  action.active
                    ? "border-primary bg-primary/12"
                    : "border-border/60 bg-card/50 hover:bg-accent"
                )}
              >
                <div className="text-sm font-semibold text-foreground">{action.label}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">
                  {action.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
