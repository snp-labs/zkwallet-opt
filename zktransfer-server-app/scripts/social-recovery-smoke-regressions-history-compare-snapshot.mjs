import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "snapshot",
  textFileName: "regressions-history-compare.txt",
  jsonFileName: "regressions-history-compare.json",
  latestMissingMessage: () => "",
  previousMissingMessage: () => "",
  snapshotMissingMessage: (textPath) =>
    `Missing requested smoke regressions history compare at ${textPath}. Re-run social-recovery:smoke:export for that snapshot.`,
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
