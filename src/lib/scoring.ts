export const CRITERIA = [
  { key: "innovation", label: "Innovation", max: 25 },
  { key: "impact", label: "Impact", max: 20 },
  { key: "faisabilite", label: "Faisabilité technique", max: 20 },
  { key: "prototype", label: "Qualité du prototype", max: 15 },
  { key: "pitch", label: "Présentation du pitch", max: 10 },
  { key: "questions", label: "Réponses aux questions", max: 10 },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];

export const PROJECT_NAMES = [
  "Turiho",
  "Gitega Street Marketing",
  "Echo Creative Studio",
  "Burundi e-Market",
  "Kwiga Design",
  "Ingoma Creative Hub",
  "Marketing Solutions Agency",
  "Gitega Influencers Network",
] as const;

export const PROJECT_COUNT = PROJECT_NAMES.length;
export const JURY_NAMES = ["Juré 1", "Juré 2 (Président)", "Juré 3"] as const;
export const PRESIDENT_JURY = JURY_NAMES[1];
