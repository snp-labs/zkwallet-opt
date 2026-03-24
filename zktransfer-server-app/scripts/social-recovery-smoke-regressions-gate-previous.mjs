import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const payload = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "previous",
  textFileName: "regressions-gate.txt",
  jsonFileName: "regressions-gate.json",
  latestMissingMessage: () => "",
  previousMissingMessage: (textPath) =>
    `Missing previous regressions gate at ${textPath}. Re-run social-recovery:smoke:export.`,
  snapshotMissingMessage: () => "",
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
