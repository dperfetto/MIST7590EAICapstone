import { useEffect, useState } from "react";
import { type Audit } from "@/workspace/types";
import { getAllAuditEvents, getAuditPage } from "@/lib/queries";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function AuditLog() {
  const pageSize = 25;
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<Audit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);

    getAuditPage(page, pageSize)
      .then((result) => {
        if (!active) return;
        setEvents(result.events);
        setTotal(result.total);
      })
      .catch((error) => {
        if (active) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not load audit history",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const firstEvent = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastEvent = Math.min(page * pageSize, total);

  const exportCsv = async () => {
    setExporting(true);

    try {
      const allEvents = await getAllAuditEvents();
      const escapeCsv = (value: unknown) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;
      const rows = [
        ["Timestamp", "Agreement ID", "Event", "Actor", "Details"],
        ...allEvents.map((event) => [
          new Date(event.createdAt).toLocaleString(),
          event.agreementId ?? "",
          event.eventType,
          event.actorName,
          event.detail,
        ]),
      ];
      const csv = rows
        .map((row) => row.map(escapeCsv).join(","))
        .join("\r\n");
      const blob = new Blob(["\uFEFF", csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `calder-audit-log-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`${allEvents.length} audit events exported.`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not export audit history",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attributable audit history</CardTitle>
        <p>
          Append-only activity across intake, analysis, review, playbook, and
          disposition.
        </p>
      </CardHeader>
      <CardContent>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 18,
          }}
        >
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={exporting || total === 0}
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>

        {loading ? (
          <p>Loading audit history...</p>
        ) : (
          <div className="timeline">
            {events.map((e) => (
              <div key={e.id}>
                <span className="timeline-dot" />
                <time>{new Date(e.createdAt).toLocaleString()}</time>
                <section>
                  <strong>{e.eventType}</strong>
                  <p>{e.detail}</p>
                  <small>
                    {e.actorName}
                    {e.agreementId ? ` · ${e.agreementId}` : ""}
                  </small>
                </section>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            borderTop: "1px solid #e2e8ef",
            marginTop: 8,
            paddingTop: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span>
            Showing {firstEvent}-{lastEvent} of {total} audit events
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={16} />
              Previous
            </Button>
            <span>
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Next
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
