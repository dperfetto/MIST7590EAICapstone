import { type Agreement } from "@/workspace/types";
import { useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, FileText, Search } from "lucide-react";
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
  onSelect?: (s: string) => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  return (
    <Card>
      <CardHeader className="table-tools">
        <div>
          <CardTitle>Agreement register</CardTitle>
          <p>All versions, workflow states, and due dates</p>
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
        {rows.map((a) => (
          <button key={a.id} disabled={!onSelect} onClick={() => onSelect?.(a.id)}>
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
            <ChevronRight size={17} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
