import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const payload = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "snapshot",
  textFileName: "regressions-gate.txt",
  jsonFileName: "regressions-gate.json",
  latestMissingMessage: () => "",
  previousMissingMessage: () => "",
  snapshotMissingMessage: (textPath) =>
    `Missing snapshot regressions gate at ${textPath}. Re-run social-recovery:smoke:export for that snapshot.`,
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    gatePath: payload.textPath,
    gateJsonPath: payload.jsonPath,
    gate: payload.artifact,
    baseDir: payload.baseDir,
    latestDir: payload.latestDir,
    snapshot: payload.snapshot,
    text: payload.text,
  },
});
