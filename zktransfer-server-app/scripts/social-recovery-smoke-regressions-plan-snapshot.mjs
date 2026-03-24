import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "snapshot",
  textFileName: "regressions-plan.txt",
  jsonFileName: "regressions-plan.json",
  latestMissingMessage: () => "",
  previousMissingMessage: () => "",
  snapshotMissingMessage: (textPath) =>
    `Missing snapshot regressions plan artifact at ${textPath}.`,
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    snapshot: saved.snapshot,
    planPath: saved.textPath,
    planJsonPath: saved.jsonPath,
    plan: saved.artifact,
    text: saved.text,
  },
});
