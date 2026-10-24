import { type Data } from "@/workspace/types";
import { useState } from "react";
import { roleLabels, type UserRole } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ProfileAccess({
  me,
  users,
  update,
}: {
  me: Data["me"];
  users: NonNullable<Data["users"]>;
  update: (b: Record<string, unknown>) => Promise<boolean>;
}) {
  const [name, setName] = useState(me.name);
  const permissions: Record<UserRole, string[]> = {
    submitter: ["Submit agreements", "Track your submissions", "View final outcomes"],
    reviewer: ["Work the review queue", "Add manual findings", "Accept, dismiss, or escalate"],
    approver: ["Reviewer capabilities", "Resolve escalated items", "Set final disposition"],
    administrator: ["Manage playbooks", "Assign access", "View reporting and audit history"],
  };
  return (
    <div className="profile-access-grid">
      <Card>
        <CardHeader>
          <CardTitle>Profile & access</CardTitle>
          <p>Your assigned role controls the work areas and actions available to you.</p>
        </CardHeader>
        <CardContent className="profile-form">
          <Label>Full name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <span className="field-help">
            Your role is assigned by an Administrator. Profile settings cannot change permissions.
          </span>
          <Button onClick={() => update({ action: "update_profile", name })}>
            Save profile
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Current access</CardTitle></CardHeader>
        <CardContent className="access-summary">
          <Badge variant="outline" className="green-tone">{roleLabels[me.role]}</Badge>
          <h3>{me.name}</h3><p>{me.email}</p>
          <ul>{permissions[me.role].map((permission) => <li key={permission}><CheckCircle2 size={16}/>{permission}</li>)}</ul>
        </CardContent>
      </Card>
      {me.role === "administrator" && (
        <Card className="access-admin-card">
          <CardHeader><CardTitle>Access administration</CardTitle><p>Approve requests and assign each user’s operating role.</p></CardHeader>
          <CardContent className="access-user-list">
            {users.map((user) => <AccessUser key={user.id} user={user} update={update}/>) }
          </CardContent>
        </Card>
      )}
    </div>
  );
}
function AccessUser({ user, update }: { user: NonNullable<Data["users"]>[number]; update: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [role, setRole] = useState<UserRole>(user.role);
  return <div className="access-user-row"><div><strong>{user.name}</strong><span>Current: {roleLabels[user.role]}</span></div><Select value={role} onValueChange={(value)=>setRole(value as UserRole)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="submitter">Submitter</SelectItem><SelectItem value="reviewer">Reviewer</SelectItem><SelectItem value="approver">Approver</SelectItem><SelectItem value="administrator">Administrator</SelectItem></SelectContent></Select><Button variant="outline" disabled={role===user.role} onClick={()=>update({action:"assign_role",userId:user.id,role})}>Assign</Button></div>;
}
