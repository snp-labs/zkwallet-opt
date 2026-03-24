import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "latest",
  textFileName: "regressions-integrity.txt",
  jsonFileName: "regressions-integrity.json",
  latestMissingMessage: (textPath) =>
    `Missing latest smoke regressions integrity at ${textPath}. Run social-recovery:smoke:export first.`,
  previousMissingMessage: () => "",
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    latestDir: saved.latestDir,
    integrityPath: saved.textPath,
    integrityJsonPath: saved.jsonPath,
    integrity: saved.artifact,
    text: saved.text,
  },
});
