import { UserRole } from "@prisma/client";

type RouteRule = readonly [prefix: string, roles: readonly UserRole[]];

export const financeRoles: readonly UserRole[] = ["OWNER", "MANAGER", "FINANCE"];
export const operationalEmployeeRoles: readonly UserRole[] = ["PRODUCTION", "WAREHOUSE", "FINANCE", "SUPPORT"];
export const ownerAssignableRoles: readonly UserRole[] = ["MANAGER", ...operationalEmployeeRoles];

export const pageRoleRules: readonly RouteRule[] = [
  ["/app/settings/data", ["OWNER"]],
  ["/app/jobs", ["OWNER", "MANAGER"]],
  ["/app/dashboard", financeRoles],
  ["/app/exports", financeRoles],
  ["/app/expenses", financeRoles],
  ["/app/printer-maintenance", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/app/printer-parts", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/app/tool-assets", financeRoles],
  ["/app/gcode", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/app/cost-imports", financeRoles],
  ["/app/settings/users", ["OWNER", "MANAGER"]],
  ["/app/reports", financeRoles],
  ["/app/purchases", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/app/inventory", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/app/shipments", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/app/production", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/app/after-sales", ["OWNER", "MANAGER", "SUPPORT"]],
  ["/app/orders", ["OWNER", "MANAGER", "SUPPORT"]],
  ["/app/products", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/app/skus", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/app/boms", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/app/settings/materials", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/app/settings/packaging", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/app/settings/suppliers", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/app/settings/printers", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/app/settings/shops", ["OWNER", "MANAGER"]]
];

export const apiRoleRules: readonly RouteRule[] = [
  ["/api/data-management", ["OWNER"]],
  ["/api/jobs", ["OWNER", "MANAGER"]],
  ["/api/exports", financeRoles],
  ["/api/expenses", financeRoles],
  ["/api/printer-maintenance", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/api/printer-parts", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/api/tool-assets", financeRoles],
  ["/api/gcode", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/api/cost-imports", financeRoles],
  ["/api/users", ["OWNER", "MANAGER"]],
  ["/api/purchases", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/api/inventory", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/api/shipments", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/api/production", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/api/after-sales", ["OWNER", "MANAGER", "SUPPORT"]],
  ["/api/orders", ["OWNER", "MANAGER", "SUPPORT"]],
  ["/api/products", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/api/skus", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/api/boms", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/api/materials", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/api/packaging", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/api/suppliers", ["OWNER", "MANAGER", "WAREHOUSE"]],
  ["/api/printers", ["OWNER", "MANAGER", "PRODUCTION"]],
  ["/api/shops", ["OWNER", "MANAGER"]]
];

export function allowedRolesForPath(pathname: string, rules: readonly RouteRule[]) {
  return rules.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? null;
}

export function isUserRole(role: string): role is UserRole {
  return role === "OWNER"
    || role === "MANAGER"
    || role === "PRODUCTION"
    || role === "WAREHOUSE"
    || role === "FINANCE"
    || role === "SUPPORT";
}

export function canAccessPath(pathname: string, role: UserRole, rules: readonly RouteRule[]) {
  const roles = allowedRolesForPath(pathname, rules);
  return !roles || roles.includes(role);
}

export function homePathForRole(role: UserRole) {
  switch (role) {
    case "SUPPORT":
      return "/app/orders";
    case "PRODUCTION":
      return "/app/production";
    case "WAREHOUSE":
      return "/app/inventory";
    default:
      return "/app/dashboard";
  }
}

export function canAssignEmployeeRole(actorRole: UserRole, targetRole: UserRole) {
  if (targetRole === "OWNER") return false;
  return actorRole === "OWNER"
    ? ownerAssignableRoles.includes(targetRole)
    : actorRole === "MANAGER" && operationalEmployeeRoles.includes(targetRole);
}
