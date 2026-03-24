import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "previous",
  textFileName: "regressions-summary.md",
  jsonFileName: "regressions-summary.json",
  latestMissingMessage: () => "",
  previousMissingMessage: (textPath) =>
    `Missing previous snapshot regressions summary artifact at ${textPath}.`,
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    snapshot: saved.snapshot,
    summaryPath: saved.textPath,
    summaryJsonPath: saved.jsonPath,
    summary: saved.artifact,
    text: saved.text,
  },
});
