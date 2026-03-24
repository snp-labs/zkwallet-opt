import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "snapshot",
  textFileName: "regressions-history-compare-check.txt",
  jsonFileName: "regressions-history-compare-check.json",
  latestMissingMessage: () => "",
  previousMissingMessage: () => "",
  snapshotMissingMessage: (textPath) =>
    `Missing named smoke regressions history compare check at ${textPath}.`,
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    latestDir: saved.latestDir,
    snapshot: saved.snapshot,
    checkPath: saved.textPath,
    checkJsonPath: saved.jsonPath,
    check: saved.artifact,
    text: saved.text,
  },
});
