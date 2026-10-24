import { type Rule } from "@/workspace/types";
import { type AnalysisFinding, type AnalysisMode, analyzeExtractedText, extractDocumentText, rememberAgreementFile, rememberAgreementText } from "@/lib/analyze";

export type IntakeDetails = {
  vendor: string;
  agreementType: string;
  businessUnit: string;
  neededBy: string;
};

export const businessUnits = ["Corporate IT", "Operations", "Finance", "Distribution"];

export type Submit = (b: Record<string, unknown>, options?: { quiet?: boolean }) => Promise<boolean>;

export type IntakeOutcome = { ok: boolean; message: string; agreementId?: string };

const uploadSelectedFile = async (file: File) => {
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

/**
 * One agreement through the intake pipeline: validate the text, upload the
 * file, store the agreement, then run analysis as a separate step. Single and
 * bulk intake both use this, so every file gets the same checks.
 */
export async function submitAgreement({
  file,
  details,
  analysisMode,
  rules,
  submit,
  onStatus,
}: {
  file: File;
  details: IntakeDetails;
  analysisMode: AnalysisMode;
  rules: Rule[];
  submit: (b: Record<string, unknown>) => Promise<boolean>;
  onStatus: (status: string) => void;
}): Promise<IntakeOutcome> {
  onStatus("Preparing document…");
  let extractedText = "";
  try {
    onStatus("Validating searchable document text…");
    extractedText = await extractDocumentText(file);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The document could not be read.";
    return { ok: false, message: `${message} Submission was not stored.` };
  }
  let uploadResult: { filename: string; key: string };
  try {
    onStatus("Uploading file…");
    uploadResult = await uploadSelectedFile(file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return { ok: false, message: `${message} Submission was not stored.` };
  }
  rememberAgreementText(uploadResult.key, extractedText);
  rememberAgreementFile(uploadResult.key, file);
  const agreementId = `agr-${crypto.randomUUID().slice(0, 8)}`;
  if (
    !(await submit({
      action: "create_agreement",
      id: agreementId,
      status:
        analysisMode === "manual" ? "manual_review_required" : "ready_for_review",
      ...details,
      filename: uploadResult.filename,
      storageKey: uploadResult.key,
      // Recorded so the review queue knows how to present the document.
      analysisPath: analysisMode,
    }))
  )
    return { ok: false, message: "The agreement could not be saved. Submission was not stored." };
  const analysisStarted = performance.now();
  let result: {
    method: "manual" | "ai" | "deterministic";
    findings: AnalysisFinding[];
    notice: string;
  };
  try {
    onStatus(
      analysisMode === "automatic"
        ? "Agreement stored. Trying hosted extraction, with deterministic fallback…"
        : analysisMode === "deterministic"
          ? "Agreement stored. Running deterministic analysis…"
          : "Agreement stored. Opening the manual review path…",
    );
    result = await analyzeExtractedText(
      extractedText,
      details.agreementType,
      analysisMode,
      rules.filter((rule) => rule.agreementType === details.agreementType),
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
  return { ok: true, message: result.notice, agreementId };
}
