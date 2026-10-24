import { type Rule } from "@/workspace/types";
import { useState } from "react";
import { type AnalysisFinding, type AnalysisMode, analyzeExtractedText, extractDocumentText, rememberAgreementFile, rememberAgreementText } from "@/lib/analyze";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { agreementTypes } from "@/lib/model";
import { FileSearch, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Intake({
  submit,
  busy,
  rules,
}: {
  submit: (b: Record<string, unknown>) => Promise<boolean>;
  busy: boolean;
  rules: Rule[];
}) {
  const [form, setForm] = useState({
      vendor: "",
      agreementType: "Software Subscription",
      businessUnit: "Corporate IT",
      neededBy: "",
      filename: "",
      storageKey: "",
    }),
    [file, setFile] = useState<File | null>(null),
    [analysisMode, setAnalysisMode] = useState<AnalysisMode>("automatic"),
    [analysisStatus, setAnalysisStatus] = useState(""),
    [submitting, setSubmitting] = useState(false);
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
    setAnalysisStatus("Preparing document…");
    let next = { ...form };
    let extractedText = "";
    const uploadSelectedFile = async () => {
      const fd = new FormData();
      fd.append("file", file);
      const response = await fetch("/api/workspace", {
        method: "PUT",
        body: fd,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === "string" ? result.error : "Upload failed.",
        );
      return result as { filename: string; key: string };
    };
    try {
      setAnalysisStatus("Validating searchable document text…");
      extractedText = await extractDocumentText(file);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The document could not be read.";
      setAnalysisStatus(`${message} Submission was not stored.`);
      toast.error(`${message} Submission was not stored.`);
      return;
    }
    let uploadResult: { filename: string; key: string };
    try {
      uploadResult = await uploadSelectedFile();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setAnalysisStatus(`${message} Submission was not stored.`);
      toast.error(`${message} Submission was not stored.`);
      return;
    }
    next = {
      ...next,
      filename: uploadResult.filename,
      storageKey: uploadResult.key,
    };
    rememberAgreementText(uploadResult.key, extractedText);
    rememberAgreementFile(uploadResult.key, file);
    const agreementId = `agr-${crypto.randomUUID().slice(0, 8)}`;
    if (
      await submit({
        action: "create_agreement",
        id: agreementId,
        status:
          analysisMode === "manual" ? "manual_review_required" : "ready_for_review",
        ...next,
        // Recorded so the review queue knows how to present the document.
        analysisPath: analysisMode,
      })
    ) {
      const analysisStarted = performance.now();
      let result: {
        method: "manual" | "ai" | "deterministic";
        findings: AnalysisFinding[];
        notice: string;
      };
      try {
        setAnalysisStatus(
          analysisMode === "automatic"
            ? "Agreement stored. Trying hosted extraction, with deterministic fallback…"
            : analysisMode === "deterministic"
              ? "Agreement stored. Running deterministic analysis…"
              : "Agreement stored. Opening the manual review path…",
        );
        result = await analyzeExtractedText(
          extractedText,
          form.agreementType,
          analysisMode,
          rules.filter((rule) => rule.agreementType === form.agreementType),
        );
      } catch {
        result = {
          method: "manual",
          findings: [],
          notice:
            "Agreement stored. Automated analysis failed, so guided manual review remains available.",
        };
      }
      const analysisDurationMs = Math.round(performance.now() - analysisStarted);
      await submit({
        action: "add_analysis_findings",
        agreementId,
        analysisMethod: result.method,
        analysisDurationMs,
        findings: result.findings,
      });
      setAnalysisStatus(result.notice);
      toast.success(result.notice);
      setForm({
        vendor: "",
        agreementType: "Software Subscription",
        businessUnit: "Corporate IT",
        neededBy: "",
        filename: "",
        storageKey: "",
      });
      setFile(null);
    }
  };
  return (
    <div className="form-layout">
      <section>
        <div className="section-title">
          <h2>Submit a vendor agreement</h2>
          <p>
            Provide the minimum information needed to route and review this
            agreement.
          </p>
        </div>
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
                  <SelectItem value="Corporate IT">Corporate IT</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Distribution">Distribution</SelectItem>
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
