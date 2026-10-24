import { type Rule } from "@/workspace/types";
import { useState } from "react";
import { type AnalysisMode } from "@/lib/analyze";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agreementTypes } from "@/lib/model";
import { AlertCircle, CheckCircle2, Clock, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type IntakeDetails, type Submit, businessUnits, submitAgreement } from "@/pages/intake/submitAgreement";

export const MAX_BULK_FILES = 20;

type RowState = "waiting" | "running" | "done" | "failed";
type Row = {
  key: string;
  file: File;
  // Only the fields changed for this file; the rest come from the shared details.
  overrides: Partial<IntakeDetails>;
  state: RowState;
  message: string;
};

const fileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

function DetailSelect({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const stateIcon: Record<RowState, React.ReactNode> = {
  waiting: <Clock size={15} aria-hidden="true" />,
  running: <Loader2 size={15} className="animate-spin" aria-hidden="true" />,
  done: <CheckCircle2 size={15} aria-hidden="true" />,
  failed: <AlertCircle size={15} aria-hidden="true" />,
};

export function BulkIntake({
  submit,
  rules,
  onRunningChange,
}: {
  submit: Submit;
  rules: Rule[];
  onRunningChange: (running: boolean) => void;
}) {
  const [shared, setShared] = useState<IntakeDetails>({
      vendor: "",
      agreementType: "Software Subscription",
      businessUnit: "Corporate IT",
      neededBy: "",
    }),
    [analysisMode, setAnalysisMode] = useState<AnalysisMode>("automatic"),
    [rows, setRows] = useState<Row[]>([]),
    [running, setRunning] = useState(false);
  const detailsFor = (row: Row): IntakeDetails => ({ ...shared, ...row.overrides });
  const updateRow = (key: string, change: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const override = (row: Row, field: keyof IntakeDetails, value: string) =>
    updateRow(row.key, { overrides: { ...row.overrides, [field]: value } });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const known = new Set(rows.map((row) => fileKey(row.file)));
    const fresh = [...list].filter((file) => !known.has(fileKey(file)));
    const room = MAX_BULK_FILES - rows.length;
    if (fresh.length > room)
      toast.error(`Bulk intake takes up to ${MAX_BULK_FILES} files at a time; ${fresh.length - Math.max(room, 0)} were not added.`);
    setRows([
      ...rows,
      ...fresh.slice(0, Math.max(room, 0)).map((file) => ({
        key: fileKey(file),
        file,
        overrides: {},
        state: "waiting" as const,
        message: "Waiting",
      })),
    ]);
  };

  const pending = rows.filter((row) => row.state !== "done");
  const run = async () => {
    if (!pending.length) {
      toast.error("Add at least one PDF or TXT file.");
      return;
    }
    const incomplete = pending.filter((row) => {
      const details = detailsFor(row);
      return !details.vendor.trim() || !details.neededBy;
    });
    if (incomplete.length) {
      for (const row of incomplete) updateRow(row.key, { state: "failed", message: "Add a vendor and a needed-by date." });
      toast.error("Every file needs a vendor and a needed-by date.");
      return;
    }
    setRunning(true);
    onRunningChange(true);
    let stored = 0;
    try {
      // One file at a time, so each gets the same checks as single intake
      // and the AI endpoint is not flooded.
      for (const row of pending) {
        updateRow(row.key, { state: "running", message: "Starting…" });
        let outcome;
        try {
          outcome = await submitAgreement({
            file: row.file,
            details: { ...detailsFor(row), vendor: detailsFor(row).vendor.trim() },
            analysisMode,
            rules,
            submit: (body) => submit(body, { quiet: true }),
            onStatus: (message) => updateRow(row.key, { message }),
          });
        } catch (error) {
          outcome = { ok: false, message: error instanceof Error ? error.message : "Submission failed." };
        }
        if (outcome.ok) stored += 1;
        updateRow(row.key, {
          state: outcome.ok ? "done" : "failed",
          message: outcome.ok && outcome.agreementId ? `${outcome.agreementId}: ${outcome.message}` : outcome.message,
        });
      }
    } finally {
      setRunning(false);
      onRunningChange(false);
    }
    const failed = pending.length - stored;
    if (failed) toast.error(`${stored} of ${pending.length} agreements stored; ${failed} need attention.`);
    else toast.success(`${stored} agreement${stored === 1 ? "" : "s"} stored and sent for review.`);
  };

  const finished = rows.filter((row) => row.state === "done" || row.state === "failed").length;
  const done = rows.filter((row) => row.state === "done").length;

  return (
    <div className="intake-form bulk-intake">
      <fieldset className="bulk-shared" disabled={running}>
        <legend>Details for every file</legend>
        <div>
          <Label htmlFor="bulk-vendor">Vendor</Label>
          <Input
            id="bulk-vendor"
            value={shared.vendor}
            onChange={(e) => setShared({ ...shared, vendor: e.target.value })}
            placeholder="Vendor legal name (or set it per file)"
          />
        </div>
        <div className="form-grid">
          <div>
            <Label>Agreement type</Label>
            <DetailSelect
              label="Agreement type for every file"
              value={shared.agreementType}
              options={agreementTypes}
              onChange={(agreementType) => setShared({ ...shared, agreementType })}
              disabled={running}
            />
          </div>
          <div>
            <Label>Business unit</Label>
            <DetailSelect
              label="Business unit for every file"
              value={shared.businessUnit}
              options={businessUnits}
              onChange={(businessUnit) => setShared({ ...shared, businessUnit })}
              disabled={running}
            />
          </div>
        </div>
        <div className="form-grid">
          <div>
            <Label htmlFor="bulk-needed-by">Needed-by date</Label>
            <Input
              id="bulk-needed-by"
              type="date"
              value={shared.neededBy}
              onChange={(e) => setShared({ ...shared, neededBy: e.target.value })}
            />
          </div>
          <div>
            <Label>Analysis path</Label>
            <Select
              value={analysisMode}
              onValueChange={(value) => setAnalysisMode(value as AnalysisMode)}
              disabled={running}
            >
              <SelectTrigger aria-label="Analysis path for every file">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">Automatic: AI → deterministic fallback</SelectItem>
                <SelectItem value="deterministic">Deterministic only</SelectItem>
                <SelectItem value="manual">Manual review only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      <label className={`drop ${running ? "is-disabled" : ""}`}>
        <Upload size={24} />
        <strong>Choose PDF or TXT files</strong>
        <span>
          Up to {MAX_BULK_FILES} files, 10 MB each. Each file is checked on its own; one bad file does not stop the rest.
        </span>
        <input
          type="file"
          multiple
          disabled={running}
          accept="application/pdf,text/plain,.pdf,.txt"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {rows.length > 0 && (
        <div className="bulk-files">
          <div className="bulk-files-head">
            <strong>
              {rows.length} file{rows.length === 1 ? "" : "s"}
            </strong>
            {(running || finished > 0) && (
              <span>
                {finished} of {rows.length} processed · {done} stored
              </span>
            )}
          </div>
          {(running || finished > 0) && (
            <Progress value={(finished / rows.length) * 100} aria-label="Bulk intake progress" />
          )}
          <ol>
            {rows.map((row) => {
              const details = detailsFor(row);
              const locked = running || row.state === "done";
              return (
                <li key={row.key} className={`bulk-file is-${row.state}`}>
                  <div className="bulk-file-top">
                    <span className="bulk-file-state">{stateIcon[row.state]}</span>
                    <strong title={row.file.name}>{row.file.name}</strong>
                    {!locked && (
                      <button
                        type="button"
                        className="bulk-file-remove"
                        aria-label={`Remove ${row.file.name}`}
                        onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <div className="bulk-file-fields">
                    <Input
                      aria-label={`Vendor for ${row.file.name}`}
                      value={details.vendor}
                      disabled={locked}
                      placeholder="Vendor"
                      onChange={(e) => override(row, "vendor", e.target.value)}
                    />
                    <Input
                      aria-label={`Needed-by date for ${row.file.name}`}
                      type="date"
                      value={details.neededBy}
                      disabled={locked}
                      onChange={(e) => override(row, "neededBy", e.target.value)}
                    />
                    <DetailSelect
                      label={`Agreement type for ${row.file.name}`}
                      value={details.agreementType}
                      options={agreementTypes}
                      disabled={locked}
                      onChange={(value) => override(row, "agreementType", value)}
                    />
                    <DetailSelect
                      label={`Business unit for ${row.file.name}`}
                      value={details.businessUnit}
                      options={businessUnits}
                      disabled={locked}
                      onChange={(value) => override(row, "businessUnit", value)}
                    />
                  </div>
                  <p className="bulk-file-status" role="status">
                    {row.message}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="form-actions">
        <Button type="button" onClick={() => void run()} disabled={running || !pending.length} aria-busy={running}>
          {running ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Submitting…
            </>
          ) : (
            pending.length ? `Submit ${pending.length} for review` : "Submit for review"
          )}
        </Button>
        {done > 0 && !running && (
          <Button type="button" variant="outline" onClick={() => setRows(rows.filter((row) => row.state !== "done"))}>
            Clear stored files
          </Button>
        )}
        <span>Each agreement gets its own audit record.</span>
      </div>
    </div>
  );
}
