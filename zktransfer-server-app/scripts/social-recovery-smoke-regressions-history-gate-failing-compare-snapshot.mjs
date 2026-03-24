import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "snapshot",
  textFileName: "regressions-history-gate-failing-compare.txt",
  jsonFileName: "regressions-history-gate-failing-compare.json",
  latestMissingMessage: () => "",
  previousMissingMessage: () => "",
  snapshotMissingMessage: (textPath) =>
    `Missing named smoke regressions gate-failing history compare at ${textPath}.`,
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
