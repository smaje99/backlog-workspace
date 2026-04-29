export const KNOWN_STATUSES = ["backlog", "in progress", "testing", "completed"];
export const KNOWN_PRIORITIES = ["p0", "p1", "high", "medium", "low"];

export const SECTION_DEFINITIONS = [
  { key: "historia", heading: "Historia", required: true },
  { key: "alcance", heading: "Alcance", required: false },
  {
    key: "criterios",
    heading: "Criterios de aceptacion",
    required: true
  },
  { key: "notas", heading: "Notas tecnicas", required: false },
  { key: "observaciones", heading: "Observaciones", required: true }
];

export const SECTION_ALIASES = new Map(
  SECTION_DEFINITIONS.map((section) => [section.key, section.heading])
);
