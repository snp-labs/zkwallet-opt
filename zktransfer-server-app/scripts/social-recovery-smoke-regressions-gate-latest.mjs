import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const payload = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "latest",
  textFileName: "regressions-gate.txt",
  jsonFileName: "regressions-gate.json",
  latestMissingMessage: (textPath) =>
    `Missing saved regressions gate at ${textPath}. Run social-recovery:smoke:export first.`,
  previousMissingMessage: () => "",
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
    text: payload.text,
  },
});
