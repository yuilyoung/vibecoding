import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const studio = resolve(here, "../../../../");
const requiredDocs = [
  "docs/13-pdd-image-generation-enhancement.md",
  "docs/14-fsd-image-batch.md",
  "docs/15-tdd-image-batch-architecture.md",
  "docs/16-wbs-image-generation-roadmap.md",
];
const requiredIds = ["IMG-001", "IMG-002", "IMG-003", "IMG-004", "IMG-005", "IMG-006", "IMG-007", "IMG-008", "IMG-009", "IMG-010", "IMG-011"];
const requiredEvidenceFiles = [
  "src/business/image-batch.ts",
  "server/business/image-direction-policy.mjs",
  "server/image-direction-policy.test.mjs",
  "server/image-batch-service.test.mjs",
  "server/image-batch-http.test.mjs",
  "server/studio-photo-project-adapter.test.mjs",
  "src/presentation/image-batch-view-model.test.ts",
  "tests/e2e/image-batch-studio.spec.ts",
  "tests/e2e/real-photo-studio.spec.ts",
  "src/business/image-project.test.ts",
  "tests/e2e/image-project-continuation.spec.ts",
];

const contents = await Promise.all(requiredDocs.map(async (path) => [path, await readFile(resolve(studio, path), "utf8")]));
await Promise.all(requiredEvidenceFiles.map((path) => readFile(resolve(studio, path), "utf8")));
const packageJson = JSON.parse(await readFile(resolve(studio, "package.json"), "utf8"));
const joined = contents.map(([, content]) => content).join("\n");
const missingIds = requiredIds.filter((id) => !contents.every(([, content]) => content.includes(id)));
const placeholders = contents.flatMap(([path, content]) => /\b(?:TODO|TBD|FIXME)\b/.test(content) ? [path] : []);
const missingSections = ["Presentation", "Business", "Data", "DI", "lifetime", "sequenceDiagram", "classDiagram"]
  .filter((token) => !joined.includes(token));
const missingEvidenceScripts = ["test:image-view-model", "test:api", "test:e2e"].filter((script) => typeof packageJson.scripts?.[script] !== "string");
const requiredPolicyTerms = ["adult_non_graphic_allowed", "minor_or_ambiguous_blocked", "real_person_blocked", "explicit_sex_blocked", "age_coded_sexualization_blocked"];
const missingPolicyTerms = requiredPolicyTerms.filter((term) => !joined.includes(term));

if (missingIds.length || placeholders.length || missingSections.length || missingEvidenceScripts.length || missingPolicyTerms.length) {
  console.error(JSON.stringify({ ok: false, missingIds, placeholders, missingSections, missingEvidenceScripts, missingPolicyTerms }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, documents: requiredDocs.length, requirementIds: requiredIds.length, evidenceFiles: requiredEvidenceFiles.length }, null, 2));
}
