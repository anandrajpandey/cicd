import type { Role } from "./mock-data";

export const roleAccess = {
  dashboard: ["Admin", "Approver", "Viewer"],
  incidents: ["Admin", "Approver", "Viewer"],
  approvals: ["Admin", "Approver"],
  analytics: ["Admin", "Approver"],
  settings: ["Admin"]
} satisfies Record<string, Role[]>;

export const canAccess = (role: Role, area: keyof typeof roleAccess): boolean =>
  roleAccess[area].some((allowedRole) => allowedRole === role);
