import { type Agreement } from "@/workspace/types";
import { entriesForAgreementType, taxonomy } from "@/lib/candidateRetrieval";
import { useState } from "react";
import { loadAgreementText, sourceTextInDocument } from "@/lib/analyze";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ManualFinding({
  agreement,
  submit,
}: {
  agreement: Agreement;
  submit: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const categories = entriesForAgreementType(agreement.agreementType);
  const provisions = (categories.length ? categories : taxonomy).map(
    (entry) => entry.calderProvision,
  );
  const blank = {
    provision: provisions[0] ?? "",
    confidence: "100",
    sourceText: "",
    reason: "",
  };
  const [open, setOpen] = useState(false),
    [f, setF] = useState(blank),
    [checking, setChecking] = useState(false),
    [problem, setProblem] = useState("");
  const confidence = Number(f.confidence);
  const confidenceValid =
    f.confidence.trim() !== "" &&
    Number.isFinite(confidence) &&
    confidence >= 0 &&
    confidence <= 100;
  const ready =
    provisions.includes(f.provision) &&
    f.sourceText.trim() !== "" &&
    confidenceValid;
  const add = async () => {
    setChecking(true);
    setProblem("");
    try {
      const text = await loadAgreementText(agreement.storageKey);
      if (text && !sourceTextInDocument(f.sourceText, text)) {
        setProblem(
          "This text was not found in the agreement. Paste it exactly as it appears in the document.",
        );
        return;
      }
      if (
        await submit({
          action: "add_manual_finding",
          agreementId: agreement.id,
          provision: f.provision,
          confidence,
          sourceText: f.sourceText.trim(),
          reason: f.reason,
          sourceVerified: Boolean(text),
        })
      ) {
        setOpen(false);
        setF(blank);
        if (!text)
          toast.warning(
            "Finding added, but the agreement file was unavailable, so the source text could not be verified.",
          );
      }
    } finally {
      setChecking(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setProblem("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus size={16} /> Add manual finding
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add source-linked finding</DialogTitle>
          <DialogDescription>
            Use this path when automation is unavailable or needs correction.
            The source text is checked against the stored agreement.
          </DialogDescription>
        </DialogHeader>
        <div className="decision-form">
          <Label>Provision</Label>
          <Select
            value={f.provision}
            onValueChange={(provision) => setF({ ...f, provision })}
          >
            <SelectTrigger aria-label="Provision">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provisions.map((provision) => (
                <SelectItem key={provision} value={provision}>
                  {provision}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label>Confidence (0-100)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            value={f.confidence}
            aria-invalid={!confidenceValid}
            onChange={(e) => setF({ ...f, confidence: e.target.value })}
          />
          {!confidenceValid && (
            <p className="field-error" role="alert">
              Enter a number from 0 to 100.
            </p>
          )}
          <Label>Exact source text</Label>
          <Textarea
            value={f.sourceText}
            aria-invalid={!!problem}
            onChange={(e) => {
              setF({ ...f, sourceText: e.target.value });
              setProblem("");
            }}
          />
          {problem && (
            <p className="field-error" role="alert">
              {problem}
            </p>
          )}
          <Label>Reviewer note (optional)</Label>
          <Textarea
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
          />
          <Button disabled={!ready || checking} onClick={add}>
            {checking ? "Checking source text…" : "Add finding"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
