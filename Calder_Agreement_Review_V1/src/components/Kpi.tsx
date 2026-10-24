import { Card, CardContent } from "@/components/ui/card";

export function Kpi({
  label: l,
  value,
  note,
  icon: Icon,
  danger,
}: {
  label: string;
  value: number;
  note: string;
  icon: any;
  danger?: boolean;
}) {
  return (
    <Card className="kpi">
      <CardContent>
        <div className={danger ? "kpi-icon danger" : "kpi-icon"}>
          <Icon size={19} />
        </div>
        <span>{l}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </CardContent>
    </Card>
  );
}
