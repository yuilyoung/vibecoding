import { createHash } from "node:crypto";

export const DASHBOARD_PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/i;
const RESERVED_PROJECT_IDS = new Set(["unassigned", "workspace"]);

export const deriveDashboardProjectId = (value) => {
  const name = String(value ?? "project");
  if (DASHBOARD_PROJECT_ID_PATTERN.test(name) && !RESERVED_PROJECT_IDS.has(name.toLowerCase())) return name;
  const digest = createHash("sha256").update(name).digest("hex").slice(0, 12);
  const ascii = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  const prefix = (ascii || "project").slice(0, 96 - digest.length - 1).replace(/[-._]+$/g, "") || "project";
  return `${prefix}-${digest}`;
};
