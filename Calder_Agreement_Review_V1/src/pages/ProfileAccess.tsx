import { type Data } from "@/workspace/types";
import { useState } from "react";
import { roleLabels, type UserRole } from "@/lib/model";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type User = NonNullable<Data["users"]>[number];

// Roles are cumulative: each adds to the one before it (see allowedViews in
// workspace/navigation.ts and the row-level security in schema.sql).
const roleOrder: UserRole[] = ["submitter", "reviewer", "approver", "administrator"];
const roleAdds: Record<UserRole, string[]> = {
  submitter: ["Submit agreements", "Track your own submissions and their outcomes", "Comment on findings in your agreements"],
  reviewer: ["Work the review queue", "Add manual findings", "Accept, dismiss or escalate findings", "View reporting and the audit log"],
  approver: ["Resolve escalated findings and set their final outcome"],
  administrator: ["Manage playbooks", "Assign roles and remove accounts", "View AI evaluation results"],
};
const inherits = (index: number) => {
  const label = roleLabels[roleOrder[index - 1]];
  return `Everything ${/^[AEIOU]/.test(label) ? "an" : "a"} ${label} can do`;
};
const permissionsFor = (role: UserRole) => {
  const index = roleOrder.indexOf(role);
  return [...(index ? [inherits(index)] : []), ...roleAdds[role]];
};
type Update = (b: Record<string, unknown>) => Promise<boolean>;

export function ProfileAccess({
  me,
  users,
  update,
}: {
  me: Data["me"];
  users: NonNullable<Data["users"]>;
  update: Update;
}) {
  const [name, setName] = useState(me.name);
  const [removing, setRemoving] = useState<User | null>(null);
  const trimmedName = name.trim();
  return (
    <div className="profile-access-grid">
      <Card>
        <CardHeader>
          <CardTitle>Your name</CardTitle>
          <p>Change how your name appears on your submissions, decisions, comments and the audit log.</p>
        </CardHeader>
        <CardContent className="profile-form">
          <Label htmlFor="profile-full-name">Full name</Label>
          <Input id="profile-full-name" value={name} onChange={(e) => setName(e.target.value)} />
          <span className="field-help">
            New activity uses the updated name; earlier records keep the name they were made under. Only an
            Administrator can change your role.
          </span>
          <Button
            disabled={!trimmedName || trimmedName === me.name}
            onClick={() => update({ action: "update_profile", name: trimmedName })}
          >
            Save name
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Current access</CardTitle></CardHeader>
        <CardContent className="access-summary">
          <Badge variant="outline" className="green-tone">{roleLabels[me.role]}</Badge>
          <h3>{me.name}</h3><p>{me.email}</p>
          <ul>{permissionsFor(me.role).map((permission) => <li key={permission}><CheckCircle2 size={16}/>{permission}</li>)}</ul>
        </CardContent>
      </Card>
      {me.role === "administrator" && (
        <Card className="access-admin-card">
          <CardHeader><CardTitle>Access administration</CardTitle><p>Assign each user’s operating role, or remove an account.</p></CardHeader>
          <CardContent className="access-user-list">
            {users.map((user) => <AccessUser key={user.id} user={user} isMe={user.id === me.id} update={update} onRemove={() => setRemoving(user)}/>) }
            <div className="role-guide">
              <h4>What each role can do</h4>
              <p>Each role includes everything the role above it can do.</p>
              <dl>
                {roleOrder.map((role) => (
                  <div key={role}>
                    <dt>{roleLabels[role]}</dt>
                    <dd>{permissionsFor(role).map((item, i) => (i ? item[0].toLowerCase() + item.slice(1) : item)).join("; ")}.</dd>
                  </div>
                ))}
              </dl>
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removing?.name}?</DialogTitle>
            <DialogDescription>
              If this account has no agreements, decisions or audit history, it is deleted. Otherwise it is
              deactivated: they can no longer sign in, their name stays on past records, and you can reactivate
              it later. Either way the removal is added to the audit log.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (removing && (await update({ action: "remove_user", userId: removing.id }))) setRemoving(null);
              }}
            >
              Remove account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function AccessUser({ user, isMe, update, onRemove }: { user: User; isMe: boolean; update: Update; onRemove: () => void }) {
  const [role, setRole] = useState<UserRole>(user.role);
  if (user.deactivated)
    return (
      <div className="access-user-row deactivated">
        <div><strong>{user.name}</strong><span>Deactivated · was {roleLabels[user.role]}</span></div>
        <Badge variant="outline">No access</Badge>
        <div className="access-user-actions">
          <Button variant="outline" onClick={() => update({ action: "reactivate_user", userId: user.id })}>Reactivate</Button>
        </div>
      </div>
    );
  return (
    <div className="access-user-row">
      <div><strong>{user.name}{isMe && " (you)"}</strong><span>Current: {roleLabels[user.role]}</span></div>
      <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
        <SelectTrigger><SelectValue/></SelectTrigger>
        <SelectContent>
          <SelectItem value="submitter">Submitter</SelectItem>
          <SelectItem value="reviewer">Reviewer</SelectItem>
          <SelectItem value="approver">Approver</SelectItem>
          <SelectItem value="administrator">Administrator</SelectItem>
        </SelectContent>
      </Select>
      <div className="access-user-actions">
        <Button variant="outline" disabled={role === user.role} onClick={() => update({ action: "assign_role", userId: user.id, role })}>Assign</Button>
        {!isMe && <Button variant="outline" className="access-remove" onClick={onRemove}>Remove</Button>}
      </div>
    </div>
  );
}
