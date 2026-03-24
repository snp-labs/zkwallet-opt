import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "snapshot",
  textFileName: "regressions-history.txt",
  jsonFileName: "regressions-history.json",
  latestMissingMessage: () => "",
  previousMissingMessage: () => "",
  snapshotMissingMessage: (textPath) =>
    `Missing smoke regressions history snapshot at ${textPath}. Re-run social-recovery:smoke:export to persist it.`,
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    latestDir: saved.latestDir,
    snapshot: saved.snapshot,
    historyPath: saved.textPath,
    historyJsonPath: saved.jsonPath,
    history: saved.artifact,
    text: saved.text,
  },
});
