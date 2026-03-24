import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "previous",
  textFileName: "regressions-doctor.txt",
  jsonFileName: "regressions-doctor.json",
  latestMissingMessage: () => "",
  previousMissingMessage: (textPath) =>
    `Missing previous snapshot regressions doctor artifact at ${textPath}.`,
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    snapshot: saved.snapshot,
    doctorPath: saved.textPath,
    doctorJsonPath: saved.jsonPath,
    doctor: saved.artifact,
    text: saved.text,
  },
});
