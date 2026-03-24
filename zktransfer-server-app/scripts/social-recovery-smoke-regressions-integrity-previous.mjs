import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "previous",
  textFileName: "regressions-integrity.txt",
  jsonFileName: "regressions-integrity.json",
  latestMissingMessage: () => "",
  previousMissingMessage: (textPath) =>
    `Missing previous smoke regressions integrity at ${textPath}. Re-run social-recovery:smoke:export to persist it.`,
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    latestDir: saved.latestDir,
    snapshot: saved.snapshot,
    integrityPath: saved.textPath,
    integrityJsonPath: saved.jsonPath,
    integrity: saved.artifact,
    text: saved.text,
  },
});
