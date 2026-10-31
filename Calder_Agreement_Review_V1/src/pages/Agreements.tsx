import { type Agreement, type Finding, type FindingComment } from "@/workspace/types";
import { type UserRole } from "@/lib/model";
import { useRef, useState } from "react";
import { isReviewComplete } from "@/lib/reviewMetrics";
import { ReviewRecord } from "@/pages/ReviewRecord";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, FileCheck2, FileText, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agreementTypes } from "@/lib/model";
import { formatDueDate, label, tone } from "@/workspace/format";
import { Badge } from "@/components/ui/badge";

export function Agreements({
  rows,
  search,
  setSearch,
  type,
  setType,
  status,
  setStatus,
  statuses,
  findings,
  comments,
  role,
  onSelect,
}: {
  rows: Agreement[];
  search: string;
  setSearch: (s: string) => void;
  type: string;
  setType: (s: string) => void;
  status: string;
  setStatus: (s: string) => void;
  statuses: string[];
  findings: Finding[];
  comments: FindingComment[];
  role: UserRole;
  onSelect?: (s: string) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  // A finished review opens its printable record here; one still in progress
  // goes to the review queue, where the work happens.
  const [recordId, setRecordId] = useState<string | null>(null);
  const record = rows.find((a) => a.id === recordId);
  if (record)
    return <ReviewRecord agreement={record} findings={findings} comments={comments} role={role} onBack={() => setRecordId(null)} />;
  return (
    <Card>
      <CardHeader className="table-tools">
        <div>
          <CardTitle>Agreement register</CardTitle>
          <p>Open a completed review to see and print its record. Reviews in progress open in the review queue.</p>
        </div>
        <div className="agreement-filters">
          <div className="global-search">
            <button
              type="button"
              aria-label="Search"
              onClick={() => searchInputRef.current?.focus()}
            >
              <Search size={16} />
            </button>
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
            />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All types</SelectItem>
              {agreementTypes.map((agreementType) => (
                <SelectItem key={agreementType} value={agreementType}>
                  {agreementType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="status-filter" aria-label="Filter by status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              {statuses.map((agreementStatus) => (
                <SelectItem key={agreementStatus} value={agreementStatus}>
                  {label(agreementStatus)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="registry">
        <div className="registry-head">
          <span>Agreement</span>
          <span>Type / unit</span>
          <span>Needed by</span>
          <span>Status</span>
          <span />
        </div>
        {rows.map((a) => {
          const complete = isReviewComplete(a, findings);
          return (
          <button
            key={a.id}
            disabled={!complete && !onSelect}
            title={complete ? "View and print the review record" : "Open in the review queue"}
            onClick={() => (complete ? setRecordId(a.id) : onSelect?.(a.id))}
          >
            <span>
              <FileText size={18} />
              <b>
                {a.vendor}
                <small>
                  {a.id} · {a.filename}
                </small>
              </b>
            </span>
            <span>
              {a.agreementType}
              <small>{a.businessUnit}</small>
            </span>
            <span>{formatDueDate(a.neededBy)}</span>
            <Badge variant="outline" className={tone(a.status)}>
              {label(a.status)}
            </Badge>
            {complete ? <FileCheck2 size={17} aria-label="Review record" /> : <ChevronRight size={17} />}
          </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
