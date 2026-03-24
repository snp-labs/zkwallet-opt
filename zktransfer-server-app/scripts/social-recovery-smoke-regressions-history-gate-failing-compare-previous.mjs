import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "previous",
  textFileName: "regressions-history-gate-failing-compare.txt",
  jsonFileName: "regressions-history-gate-failing-compare.json",
  latestMissingMessage: () => "",
  previousMissingMessage: (textPath) =>
    `Missing previous smoke regressions gate-failing history compare at ${textPath}. Re-run social-recovery:smoke:export to persist it.`,
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    latestDir: saved.latestDir,
    snapshot: saved.snapshot,
    comparePath: saved.textPath,
    compareJsonPath: saved.jsonPath,
    compare: saved.artifact,
    text: saved.text,
  },
});
