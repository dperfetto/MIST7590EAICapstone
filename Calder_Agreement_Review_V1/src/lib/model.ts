import { type FindingComment } from "@/lib/comments";
import { type PlaybookVersion } from "@/lib/playbookVersions";


export type UserRole = "submitter" | "reviewer" | "approver" | "administrator";
export const agreementTypes = [
  "Software Subscription",
  "Professional Services",
  "Licensing",
  "Logistics and Freight",
  "Data Processing Addendum",
  "Mutual NDA",
  "Other",
] as const;
export type AnalysisPath = "automatic" | "deterministic" | "manual";
export const normalizeAnalysisPath = (value: unknown): AnalysisPath | null =>
  value === "automatic" || value === "deterministic" || value === "manual"
    ? value
    : null;
export const roleLabels: Record<UserRole, string> = {
  submitter: "Submitter",
  reviewer: "Reviewer",
  approver: "Approver",
  administrator: "Administrator",
};
export const normalizeRole = (value: unknown): UserRole =>
  value === "reviewer" || value === "approver" || value === "administrator"
    ? value
    : "submitter";
export type Agreement = {
  id: string;
  vendor: string;
  agreementType: string;
  businessUnit: string;
  neededBy: string;
  filename: string;
  storageKey?: string | null;
  /** Analysis path the Requester chose at intake. Decides how the review
   *  queue shows the document: manual = full scrollable document,
   *  automatic/deterministic = small click-to-download preview.
   *  Null for agreements created before this was recorded. */
  analysisPath?: AnalysisPath | null;
  status: string;
  playbookVersion: string;
  createdAt: string;
};
export type Finding = {
  id: string;
  agreementId: string;
  provision: string;
  findingType: string;
  severity: string;
  confidence: number;
  sourceText: string;
  reason: string;
  status: string;
  decisionReason?: string;
  decidedAt?: string | null;
  analysisMethod?: string;
};
export type Rule = {
  id: string;
  agreementType: string;
  provision: string;
  applicability: string;
  standard: string;
  severity: string;
  active: boolean;
};
export type Audit = {
  id: string;
  agreementId?: string;
  actorName: string;
  eventType: string;
  detail: string;
  createdAt: string;
};
// deactivated: removed by an Administrator but kept because it has review history.
export type UserProfile = { id: string; name: string; role: UserRole; deactivated?: boolean };
export type EvaluationOutcome =
  | "found"
  | "missed"
  | "wrong_flag"
  | "correctly_silent";
export type EvaluationResult = {
  contract: string;
  provision: string;
  expertPresent: boolean;
  calderFlagged: boolean;
  outcome: EvaluationOutcome;
  confidence: number | null;
  calderQuote: string | null;
  quoteOverlaps: boolean | null;
  expertClause: string | null;
  keywordFlagged: boolean;
  methodUsed: string;
};
export type IndependentCheckResult = {
  document: string;
  agreementType: string;
  provision: string;
  editType: string;
  editDescription: string;
  version: "original" | "modified";
  expectedPresent: boolean;
  aiFlagged: boolean;
  correct: boolean;
  confidence: number | null;
  quoteTouchesEdit: boolean | null;
  aiQuote: string | null;
  keywordCorrect: boolean | null;
  diagnosis: string | null;
};
export type EvaluationRun = {
  id: string;
  kind: "cuad_check_set" | "independent_check";
  label: string;
  runAt: string;
  model: string;
  agreementType: string;
  contracts: number;
  aiCalls: number;
  aiFallbacks: number;
  notes: string;
  results: EvaluationResult[];
  checks: IndependentCheckResult[];
};
export type Data = {
  me: { id?: string; name: string; email: string; role: UserRole };
  agreements: Agreement[];
  findings: Finding[];
  rules: Rule[];
  audit: Audit[];
  comments: FindingComment[];
  playbookVersions: PlaybookVersion[];
  users?: UserProfile[];
};
export const agreementReviewStatus = (statuses: string[], currentStatus: string) => {
  if (statuses.includes("escalated")) return "escalated";
  if (statuses.length && statuses.every((status) => status === "accepted"))
    return "approved";
  if (
    statuses.length &&
    statuses.every((status) => ["accepted", "dismissed"].includes(status))
  )
    return "review_complete";
  if (statuses.some((status) => ["accepted", "dismissed"].includes(status)))
    return "in_review";
  return currentStatus;
};
export type AuditPage = {
  events: Audit[];
  total: number;
  page: number;
  pageSize: number;
};
