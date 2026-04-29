export type ItemLink = {
  id: string;
  raw: string;
};

export type LocalReference = {
  path: string;
  sha?: string;
  type?: string;
};

export type Sections = {
  historia: string;
  alcance: string;
  criterios: string;
  notas: string;
  observaciones: string;
};

export type ItemSummary = {
  id: string;
  path: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  hasAssignee: boolean;
  createdAt: string;
  sourceSection: string;
  tags: string[];
  hasTags: boolean;
  hasCriterios: boolean;
  links: ItemLink[];
  references: LocalReference[];
  preview: string;
};

export type BacklogItem = ItemSummary & {
  sections: Sections;
  rawMarkdown: string;
  version: string;
};

export type MetaCounts = {
  total: number;
  statuses: Record<string, number>;
  priorities: Record<string, number>;
  assignees: Record<string, number>;
  tags: Record<string, number>;
};

export type FilterState = {
  search: string;
  statuses: string[];
  priority: string;
  assignee: string;
  tag: string;
  quickFilter: QuickFilterKey;
};

export type QuickFilterKey = "" | "unassigned" | "untagged" | "missing-criteria";

export type ViewMode = "board" | "list";

export type StructuredSavePayload = {
  version: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  tags: string[];
  sections: Sections;
};
