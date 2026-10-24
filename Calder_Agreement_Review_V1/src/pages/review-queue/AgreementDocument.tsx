import { type Agreement } from "@/workspace/types";
import { useEffect, useRef, useState } from "react";
import { downloadFile, isPdfFile, renderPdfPages, renderPdfThumbnail } from "@/lib/documentPreview";
import { loadAgreementFile } from "@/lib/analyze";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The submitted agreement, shown inside the review queue.
 * - Manual analysis path: the reviewer is identifying provisions by hand, so
 *   the whole document is shown in a scrollable panel.
 * - Automatic / deterministic paths: findings already carry their source
 *   text, so a small first-page preview is enough; clicking it downloads
 *   the original file.
 */
export function AgreementDocument({ agreement }: { agreement: Agreement }) {
  const fullView = agreement.analysisPath === "manual";
  const [file, setFile] = useState<Blob | null>(null),
    [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
      "loading",
    ),
    [thumbnail, setThumbnail] = useState(""),
    [plainText, setPlainText] = useState("");
  const pagesRef = useRef<HTMLDivElement>(null);
  const isPdf = file ? isPdfFile(agreement.filename, file) : false;

  // 1. Find the original file (browser storage in demo, Supabase when hosted).
  useEffect(() => {
    let cancelled = false;
    loadAgreementFile(agreement.storageKey).then((found) => {
      if (cancelled) return;
      setFile(found);
      setState(found ? "ready" : "missing");
    });
    return () => {
      cancelled = true;
    };
  }, [agreement.storageKey]);

  // 2. Prepare what to show: thumbnail, every PDF page, or plain text.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const fail = () => !cancelled && setState("error");
    if (!isPdf) {
      file.text().then((text) => !cancelled && setPlainText(text), fail);
    } else if (!fullView) {
      renderPdfThumbnail(file).then(
        (image) => !cancelled && setThumbnail(image),
        fail,
      );
    } else if (pagesRef.current) {
      const container = pagesRef.current;
      container.replaceChildren();
      const width = Math.min(container.clientWidth || 720, 900);
      renderPdfPages(file, container, width, () => cancelled).catch(fail);
    }
    return () => {
      cancelled = true;
    };
  }, [file, isPdf, fullView]);

  const download = () => file && downloadFile(file, agreement.filename);

  if (state === "loading")
    return (
      <div className="agreement-document is-note" role="status">
        <Loader2 size={16} className="spin" /> Loading the submitted agreement…
      </div>
    );
  if (state === "missing")
    return (
      <div className="agreement-document is-note">
        <FileText size={16} />
        <span>
          The original file for {agreement.filename} isn't available here.
          Seeded demo agreements have no file, and demo-mode uploads stay in
          the browser they were submitted from.
        </span>
      </div>
    );

  if (!fullView)
    return (
      <div className="agreement-document is-preview">
        <button
          type="button"
          className="document-thumb"
          onClick={download}
          aria-label={`Download ${agreement.filename}`}
          title="Click to download"
        >
          {isPdf && thumbnail ? (
            <img src={thumbnail} alt={`First page of ${agreement.filename}`} />
          ) : isPdf ? (
            <FileText size={28} />
          ) : (
            <span className="thumb-text">{plainText.slice(0, 400)}</span>
          )}
          <span className="thumb-overlay">
            <Download size={16} />
          </span>
        </button>
        <div>
          <strong>Submitted agreement</strong>
          <span>{agreement.filename}</span>
          <small>Click the preview to download the original file.</small>
        </div>
      </div>
    );

  return (
    <section className="agreement-document is-full" aria-label="Submitted agreement">
      <header>
        <div>
          <strong>Submitted agreement</strong>
          <span>
            {agreement.filename} · manual review path, so the full document is
            shown
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={download}>
          <Download size={15} /> Download
        </Button>
      </header>
      {state === "error" ? (
        <p className="document-error">
          This document couldn't be displayed in the browser. Use Download to
          open it instead.
        </p>
      ) : isPdf ? (
        <div className="document-pages" ref={pagesRef} tabIndex={0} />
      ) : (
        <pre className="document-pages document-text" tabIndex={0}>
          {plainText}
        </pre>
      )}
    </section>
  );
}
