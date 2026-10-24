import { getEvaluations, getWorkspace } from "@/lib/queries";
import { performAction, uploadPdf } from "@/lib/actions";

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type"))
    headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(payload), { ...init, headers });
}
export function installWorkspaceApi() {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.pathname
          : input.url;
    if (requestUrl.endsWith("/api/evaluations")) {
      try {
        return jsonResponse(await getEvaluations());
      } catch (error) {
        return jsonResponse(
          { error: error instanceof Error ? error.message : "Unexpected error" },
          { status: 500 },
        );
      }
    }
    if (!requestUrl.endsWith("/api/workspace")) return nativeFetch(input, init);
    try {
      const method = (init?.method || "GET").toUpperCase();
      if (method === "GET") return jsonResponse(await getWorkspace());
      if (method === "POST") {
        await performAction(JSON.parse(String(init?.body || "{}")));
        return jsonResponse({ ok: true });
      }
      if (method === "PUT") {
        const form = init?.body as FormData;
        const file = form?.get("file");
        if (!(file instanceof File)) throw new Error("Choose a PDF.");
        const result = await uploadPdf(file);
        return jsonResponse({
          ok: true,
          filename: result.filename,
          key: result.key,
        });
      }
      return jsonResponse({ error: "Unsupported action" }, { status: 400 });
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : "Unexpected error" },
        { status: 500 },
      );
    }
  };
}
