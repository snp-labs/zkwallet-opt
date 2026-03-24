import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "previous",
  textFileName: "regressions-status.txt",
  jsonFileName: "regressions-status.json",
  latestMissingMessage: () => "",
  previousMissingMessage: (textPath) =>
    `Missing previous snapshot regressions status artifact at ${textPath}.`,
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    snapshot: saved.snapshot,
    statusPath: saved.textPath,
    statusJsonPath: saved.jsonPath,
    status: saved.artifact,
    text: saved.text,
  },
});
