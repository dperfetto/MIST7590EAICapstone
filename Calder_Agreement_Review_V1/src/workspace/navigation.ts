import { Archive, BarChart3, BookOpenCheck, FileSearch, FlaskConical, LayoutDashboard, ShieldCheck, Upload, UserRoundCog } from "lucide-react";
import { type UserRole } from "@/lib/data";

type NavIcon = typeof LayoutDashboard;
type NavItem = readonly [string, string, NavIcon];
type NavSection = { label: string | null; items: NavItem[] };
export const navSections: NavSection[] = [
  {
    label: null,
    items: [["overview", "Overview", LayoutDashboard]],
  },
  {
    label: "Work",
    items: [
      ["intake", "New intake", Upload],
      ["queue", "Review queue", FileSearch],
      ["agreements", "Agreements", Archive],
    ],
  },
  {
    label: "Insights",
    items: [
      ["reports", "Reporting", BarChart3],
      ["audit", "Audit log", ShieldCheck],
      ["evaluation", "AI evaluation", FlaskConical],
    ],
  },
  {
    label: "Admin",
    items: [
      ["playbook", "Playbooks", BookOpenCheck],
      ["profile", "Profile & access", UserRoundCog],
    ],
  },
];
export const nav = navSections.flatMap((section) => section.items);
export const allowedViews: Record<UserRole, string[]> = {
  submitter: ["overview", "intake", "agreements", "profile"],
  reviewer: ["overview", "intake", "queue", "agreements", "reports", "audit", "profile"],
  approver: ["overview", "intake", "queue", "agreements", "reports", "audit", "profile"],
  administrator: nav.map(([id]) => id),
};
