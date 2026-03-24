import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "previous",
  textFileName: "regressions-report.md",
  jsonFileName: "regressions-report.json",
  latestMissingMessage: () => "",
  previousMissingMessage: (textPath) =>
    `Missing previous snapshot regressions report artifact at ${textPath}.`,
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    snapshot: saved.snapshot,
    reportPath: saved.textPath,
    reportJsonPath: saved.jsonPath,
    report: saved.artifact,
    text: saved.text,
  },
});
