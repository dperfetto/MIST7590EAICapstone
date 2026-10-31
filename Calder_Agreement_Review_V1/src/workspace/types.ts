import { type FindingComment } from "@/lib/comments";
import { type PlaybookVersion } from "@/lib/playbookVersions";
import { type AnalysisPath, type UserRole } from "@/lib/model";

export type Agreement = {
  id: string;
  vendor: string;
  agreementType: string;
  businessUnit: string;
  neededBy: string;
  filename: string;
  storageKey?: string | null;
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
export type Data = {
  me: { name: string; email: string; role: UserRole };
  agreements: Agreement[];
  findings: Finding[];
  rules: Rule[];
  audit: Audit[];
  comments: FindingComment[];
  playbookVersions: PlaybookVersion[];
  aiStatus: string;
  users?: { id: string; name: string; role: UserRole }[];
};

export type { FindingComment, PlaybookVersion };
