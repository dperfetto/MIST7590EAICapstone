import { type Rule } from "@/workspace/types";
import { useState } from "react";
import { type AnalysisMode } from "@/lib/analyze";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agreementTypes } from "@/lib/model";
import { FileSearch, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BulkIntake } from "@/pages/intake/BulkIntake";
import { type Submit, businessUnits, submitAgreement } from "@/pages/intake/submitAgreement";

const emptyForm = {
  vendor: "",
  agreementType: "Software Subscription",
  businessUnit: "Corporate IT",
  neededBy: "",
};

export function Intake({
  submit,
  busy,
  rules,
}: {
  submit: Submit;
  busy: boolean;
  rules: Rule[];
}) {
  const [form, setForm] = useState(emptyForm),
    [file, setFile] = useState<File | null>(null),
    [analysisMode, setAnalysisMode] = useState<AnalysisMode>("automatic"),
    [analysisStatus, setAnalysisStatus] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [intakeMode, setIntakeMode] = useState<"single" | "bulk">("single"),
    [bulkRunning, setBulkRunning] = useState(false);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await runSubmission();
    } finally {
      setSubmitting(false);
    }
  };
  const runSubmission = async () => {
    if (!file) {
      toast.error("Choose a searchable PDF or TXT file before submitting.");
      return;
    }
    const outcome = await submitAgreement({
      file,
      details: form,
      analysisMode,
      rules,
      submit,
      onStatus: setAnalysisStatus,
    });
    setAnalysisStatus(outcome.message);
    if (!outcome.ok) {
      toast.error(outcome.message);
      return;
    }
    toast.success(outcome.message);
    setForm(emptyForm);
    setFile(null);
  };
  return (
    <div className="form-layout">
      <section>
        <div className="section-title">
          <h2>{intakeMode === "single" ? "Submit a vendor agreement" : "Submit several agreements"}</h2>
          <p>
            {intakeMode === "single"
              ? "Provide the minimum information needed to route and review this agreement."
              : "Set the details once for every file, then change any file that differs."}
          </p>
        </div>
        <div className="queue-tabs intake-tabs" role="tablist" aria-label="Intake mode">
          <button
            type="button"
            role="tab"
            aria-selected={intakeMode === "single"}
            disabled={submitting || bulkRunning}
            onClick={() => setIntakeMode("single")}
          >
            One agreement
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={intakeMode === "bulk"}
            disabled={submitting || bulkRunning}
            onClick={() => setIntakeMode("bulk")}
          >
            Bulk intake
          </button>
        </div>
        {intakeMode === "bulk" ? (
          <BulkIntake submit={submit} rules={rules} onRunningChange={setBulkRunning} />
        ) : (
        <form className="intake-form" onSubmit={send}>
          <div>
            <Label>Vendor</Label>
            <Input
              required
              value={form.vendor}
              onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              placeholder="Vendor legal name"
            />
          </div>
          <div className="form-grid">
            <div>
              <Label>Agreement type</Label>
              <Select
                value={form.agreementType}
                onValueChange={(v) => setForm({ ...form, agreementType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agreementTypes.map((agreementType) => (
                    <SelectItem key={agreementType} value={agreementType}>
                      {agreementType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Business unit</Label>
              <Select
                value={form.businessUnit}
                onValueChange={(v) => setForm({ ...form, businessUnit: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {businessUnits.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Needed-by date</Label>
            <Input
              required
              type="date"
              value={form.neededBy}
              onChange={(e) => setForm({ ...form, neededBy: e.target.value })}
            />
          </div>
          <div>
            <Label>Analysis path</Label>
            <Select
              value={analysisMode}
              onValueChange={(value) => setAnalysisMode(value as AnalysisMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">
                  Automatic: AI → deterministic fallback
                </SelectItem>
                <SelectItem value="deterministic">
                  Deterministic only
                </SelectItem>
                <SelectItem value="manual">Manual review only</SelectItem>
              </SelectContent>
            </Select>
            <span className="field-help">
              AI is optional. If it is disabled or unavailable, deterministic
              analysis runs automatically.
            </span>
          </div>
          <div>
            <Label>Agreement PDF or text file</Label>
            <label className="drop">
              <Upload size={24} />
              <strong>{file ? file.name : "Choose a PDF or TXT file"}</strong>
              <span>
                Maximum 10 MB. Image-only PDFs are rejected before submission;
                OCR is outside this release.
              </span>
              <input
                type="file"
                accept="application/pdf,text/plain,.pdf,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="form-actions">
            <Button
              type="submit"
              disabled={busy || submitting}
              aria-busy={busy || submitting}
            >
              {busy || submitting ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Submitting…
                </>
              ) : (
                "Submit for review"
              )}
            </Button>
            <span>Submission creates an attributable audit record.</span>
          </div>
          {analysisStatus && (
            <div
              className="analysis-status flex items-center gap-2"
              role="status"
            >
              {submitting && (
                <Loader2
                  size={14}
                  className="shrink-0 animate-spin"
                  aria-hidden="true"
                />
              )}
              {analysisStatus}
            </div>
          )}
        </form>
        )}
      </section>
      <aside className="process-panel">
        <h3>What happens next</h3>
        {[
          [
            "1",
            "Private intake",
            "The PDF and metadata are stored as an agreement version.",
          ],
          [
            "2",
            "Presence identification",
            "Active playbook categories return source text and confidence.",
          ],
          [
            "3",
            "Human review",
            "A reviewer accepts, dismisses, or escalates each flag.",
          ],
          [
            "4",
            "Disposition",
            "The agreement is cleared, conditioned, or escalated.",
          ],
        ].map((x) => (
          <div key={x[0]}>
            <b>{x[0]}</b>
            <p>
              <strong>{x[1]}</strong>
              <span>{x[2]}</span>
            </p>
          </div>
        ))}
        <div className="manual-note">
          <FileSearch size={18} />
          <p>
            <strong>Automation is optional</strong>
            <span>
              If analysis is unavailable, the agreement enters manual review
              without losing the workflow.
            </span>
          </p>
        </div>
      </aside>
    </div>
  );
}
