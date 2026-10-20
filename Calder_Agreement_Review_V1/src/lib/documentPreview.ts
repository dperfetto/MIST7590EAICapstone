import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

// Same PDF.js setup as analyze.ts. Rendering pages to <canvas> (instead of
// embedding the browser's PDF viewer) works the same in every browser,
// including embedded ones that block built-in PDF viewers.
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function isPdfFile(filename: string, file: Blob) {
  return file.type === "application/pdf" || /\.pdf$/i.test(filename);
}

async function drawPage(
  document: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  targetWidth: number,
) {
  const page = await document.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  // Render at device pixel ratio so text stays sharp on high-DPI screens.
  const ratio = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: (targetWidth / base.width) * ratio });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = "100%";
  canvas.setAttribute("aria-label", `Page ${pageNumber}`);
  await page.render({ canvas, viewport }).promise;
  return canvas;
}

/** First page as an image, for the small click-to-download preview. */
export async function renderPdfThumbnail(file: Blob, width = 160) {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  try {
    const document = await loadingTask.promise;
    const canvas = await drawPage(document, 1, width);
    return canvas.toDataURL("image/png");
  } finally {
    await loadingTask.destroy();
  }
}

/**
 * Every page, appended one at a time so the reviewer can start reading
 * before a long agreement finishes rendering. `isCancelled` stops work when
 * the reviewer switches to a different agreement.
 */
export async function renderPdfPages(
  file: Blob,
  container: HTMLElement,
  width: number,
  isCancelled: () => boolean,
) {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  try {
    const document = await loadingTask.promise;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (isCancelled()) return;
      const canvas = await drawPage(document, pageNumber, width);
      if (isCancelled()) return;
      container.appendChild(canvas);
    }
  } finally {
    await loadingTask.destroy();
  }
}

/** Save the original file to the reviewer's computer. */
export function downloadFile(file: Blob, filename: string) {
  const url = URL.createObjectURL(file);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before releasing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
