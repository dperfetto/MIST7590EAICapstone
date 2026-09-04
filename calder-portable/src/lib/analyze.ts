import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { supabase } from "./data";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export type AnalysisMode = "automatic" | "deterministic" | "manual";
export type AnalysisRule = {
  provision: string;
  standard: string;
  severity: string;
  active: boolean;
};
export type AnalysisFinding = {
  provision: string;
  findingType: "gap" | "deviation" | "acceptable";
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  sourceText: string;
  reason: string;
  analysisMethod: "ai" | "deterministic" | "manual";
};

type Detector = {
  provision: string;
  required: boolean;
  severity: AnalysisFinding["severity"];
  terms: RegExp;
};

const shared: Detector[] = [
  {
    provision: "Cap on Liability",
    required: true,
    severity: "high",
    terms:
      /limitation of liability|aggregate liability|liability shall not exceed|liability cap/i,
  },
  {
    provision: "Governing Law",
    required: true,
    severity: "medium",
    terms: /governed by|governing law|laws of the state of/i,
  },
];

const detectors: Record<string, Detector[]> = {
  SaaS: [
    ...shared,
    {
      provision: "Auto Renewal",
      required: false,
      severity: "medium",
      terms:
        /automatically renew|automatic renewal|successive renewal|renewal term/i,
    },
    {
      provision: "Indemnification",
      required: true,
      severity: "high",
      terms: /indemnif(?:y|ication)|defend and hold harmless/i,
    },
    {
      provision: "Termination",
      required: true,
      severity: "high",
      terms: /termination|terminate this agreement/i,
    },
    {
      provision: "Exclusivity",
      required: false,
      severity: "high",
      terms: /exclusive(?:ly)?|exclusivity/i,
    },
  ],
  "Professional Services": [
    ...shared,
    {
      provision: "Termination for Convenience",
      required: true,
      severity: "high",
      terms: /termination for convenience|terminate.*for convenience/i,
    },
    {
      provision: "Insurance",
      required: true,
      severity: "high",
      terms: /insurance|commercial general liability|professional liability/i,
    },
    {
      provision: "Warranty Duration",
      required: true,
      severity: "medium",
      terms: /warrant(?:y|ies)|warrants that|warranty period/i,
    },
    {
      provision: "Indemnification",
      required: true,
      severity: "high",
      terms: /indemnif(?:y|ication)|defend and hold harmless/i,
    },
  ],
  DPA: [
    ...shared,
    {
      provision: "Audit Rights",
      required: true,
      severity: "high",
      terms: /audit rights?|right to audit|inspection|soc 2|assurance report/i,
    },
    {
      provision: "Insurance",
      required: false,
      severity: "high",
      terms: /cyber insurance|cyber liability|insurance/i,
    },
    {
      provision: "Assignment / Control",
      required: false,
      severity: "high",
      terms: /assignment|assign this|change of control/i,
    },
    {
      provision: "Security Incident",
      required: true,
      severity: "high",
      terms: /security incident|data breach|personal data breach/i,
    },
  ],
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function snippet(text: string, index: number, length = 420) {
  const start = Math.max(0, index - 100);
  return clean(text.slice(start, Math.min(text.length, index + length)));
}

export async function extractDocumentText(file: File) {
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Upload a PDF or TXT file no larger than 10 MB.");
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt"))
    return clean(await file.text());
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  )
    throw new Error("Only PDF and TXT agreements are supported.");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(`[Page ${pageNumber}] ${clean(pageText)}`);
  }
  const text = pages.join("\n");
  if (text.replace(/\[Page \d+\]/g, "").trim().length < 40)
    throw new Error(
      "No searchable text was found. Route this scanned PDF to manual review or add OCR.",
    );
  return text;
}

function evaluateDetected(detector: Detector, source: string): AnalysisFinding {
  const base = {
    provision: detector.provision,
    severity: detector.severity,
    sourceText: source,
    analysisMethod: "deterministic" as const,
  };
  if (detector.provision === "Auto Renewal") {
    const days = source.match(
      /(\d{1,3}|thirty|sixty|ninety|one hundred twenty)[- ]day/i,
    );
    const parsed = days
      ? ({ thirty: 30, sixty: 60, ninety: 90, "one hundred twenty": 120 }[
          days[1].toLowerCase()
        ] ?? Number(days[1]))
      : null;
    return {
      ...base,
      provision: parsed ? "Renewal Notice" : detector.provision,
      findingType: parsed && parsed <= 60 ? "acceptable" : "deviation",
      confidence: parsed ? 88 : 74,
      reason: parsed
        ? `${parsed}-day renewal notice compared with the SaaS standard of 60 days or less.`
        : "Auto-renewal language detected; reviewer must verify the renewal term and notice deadline.",
    };
  }
  if (detector.provision === "Governing Law") {
    const state = source.match(
      /laws? of (?:the state of )?([A-Z][A-Za-z ]{2,24})/,
    );
    const approved = state && /Georgia|Delaware|New York/i.test(state[1]);
    return {
      ...base,
      findingType: approved ? "acceptable" : "deviation",
      confidence: state ? 90 : 72,
      reason: state
        ? `${state[1].trim()} detected as the governing jurisdiction; compare with the approved-jurisdiction list.`
        : "Governing-law language detected, but the jurisdiction requires human verification.",
    };
  }
  if (detector.provision === "Exclusivity")
    return {
      ...base,
      findingType: "deviation",
      confidence: 82,
      reason: "Exclusivity language requires review under the SaaS playbook.",
    };
  return {
    ...base,
    findingType: "deviation",
    confidence: 76,
    reason: `${detector.provision} language detected. Deterministic analysis located the clause; a reviewer must verify its structured terms against the playbook.`,
  };
}

export function runDeterministicAnalysis(
  text: string,
  agreementType: string,
  playbook: AnalysisRule[] = [],
): AnalysisFinding[] {
  const enabled = new Set(
    playbook.filter((rule) => rule.active).map((rule) => rule.provision),
  );
  const rules = (detectors[agreementType] ?? shared).filter(
    (detector) =>
      !playbook.length ||
      enabled.has(detector.provision) ||
      (detector.provision === "Auto Renewal" && enabled.has("Renewal Notice")),
  );
  return rules
    .map((detector) => {
      const match = detector.terms.exec(text);
      if (match) return evaluateDetected(detector, snippet(text, match.index));
      return {
        provision: detector.provision,
        findingType: "gap" as const,
        severity: detector.severity,
        confidence: 62,
        sourceText:
          "No responsive provision was detected by deterministic text search.",
        reason: `${detector.provision} is marked required by the ${agreementType} playbook. “Not detected” does not prove absence; human verification is required.`,
        analysisMethod: "deterministic" as const,
      };
    })
    .filter(
      (finding) =>
        finding.findingType !== "gap" ||
        rules.find((rule) => rule.provision === finding.provision)?.required,
    );
}

async function runAiAnalysis(
  text: string,
  agreementType: string,
  playbook: AnalysisRule[],
): Promise<AnalysisFinding[]> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      text: text.slice(0, 120_000),
      agreementType,
      playbook: playbook.filter((rule) => rule.active),
    }),
  });
  if (!response.ok) throw new Error("AI analysis is unavailable.");
  const payload = await response.json();
  if (!Array.isArray(payload.findings))
    throw new Error("AI analysis returned an invalid response.");
  return payload.findings.map((finding: AnalysisFinding) => ({
    ...finding,
    analysisMethod: "ai",
  }));
}

export async function analyzeDocument(
  file: File,
  agreementType: string,
  mode: AnalysisMode,
  playbook: AnalysisRule[] = [],
) {
  const text = await extractDocumentText(file);
  if (mode === "manual")
    return {
      method: "manual" as const,
      findings: [] as AnalysisFinding[],
      notice: "Agreement routed directly to guided manual review.",
    };
  if (mode === "automatic") {
    try {
      const findings = await runAiAnalysis(text, agreementType, playbook);
      return {
        method: "ai" as const,
        findings,
        notice:
          "AI analysis completed; all findings require human verification.",
      };
    } catch {
      return {
        method: "deterministic" as const,
        findings: runDeterministicAnalysis(text, agreementType, playbook),
        notice:
          "AI was unavailable, so deterministic analysis ran automatically.",
      };
    }
  }
  return {
    method: "deterministic" as const,
    findings: runDeterministicAnalysis(text, agreementType, playbook),
    notice:
      "Deterministic analysis completed; all findings require human verification.",
  };
}
