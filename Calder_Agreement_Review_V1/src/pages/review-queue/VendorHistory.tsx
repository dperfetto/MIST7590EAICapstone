import { type Agreement } from "@/workspace/types";
import { type VendorHistory as History } from "@/lib/vendorHistory";
import { label, tone } from "@/workspace/format";
import { Badge } from "@/components/ui/badge";
import { History as HistoryIcon } from "lucide-react";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function VendorHistory({
  vendor,
  history,
  open,
}: {
  vendor: string;
  history: History<Agreement>;
  open: (agreementId: string) => void;
}) {
  const count = history.agreements.length;
  return (
    <details className="vendor-history" open={count > 0}>
      <summary>
        <HistoryIcon size={16} />
        <strong>Vendor history</strong>
        <span>
          {count
            ? `${count} earlier agreement${count === 1 ? "" : "s"} with ${vendor}`
            : `No other agreements with ${vendor} yet`}
        </span>
      </summary>
      {count > 0 && (
        <div className="vendor-history-body">
          <ul className="vendor-history-agreements">
            {history.agreements.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => open(a.id)}>
                  <strong>{a.id}</strong>
                  <span>
                    {a.agreementType} · {formatDate(a.createdAt)}
                  </span>
                  <Badge variant="outline" className={tone(a.status)}>
                    {label(a.status)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
          {history.provisions.length ? (
            <table className="vendor-history-table">
              <thead>
                <tr>
                  <th scope="col">Provision</th>
                  <th scope="col">Accepted</th>
                  <th scope="col">Dismissed</th>
                  <th scope="col">Escalated</th>
                  <th scope="col">Open</th>
                  <th scope="col">Latest decision</th>
                </tr>
              </thead>
              <tbody>
                {history.provisions.map((p) => (
                  <tr key={p.provision}>
                    <th scope="row">{p.provision}</th>
                    <td>{p.accepted}</td>
                    <td>{p.dismissed}</td>
                    <td>{p.escalated}</td>
                    <td>{p.open}</td>
                    <td>
                      {p.latest ? (
                        <>
                          <b>{label(p.latest.status)}</b> ({p.latest.agreementId})
                          {p.latest.reason && <> — {p.latest.reason}</>}
                        </>
                      ) : (
                        "Not decided yet"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="vendor-history-empty">Those agreements have no findings recorded.</p>
          )}
        </div>
      )}
    </details>
  );
}
