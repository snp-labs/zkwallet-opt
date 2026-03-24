import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "latest",
  textFileName: "regressions-history-compare-check.txt",
  jsonFileName: "regressions-history-compare-check.json",
  latestMissingMessage: (textPath) =>
    `Missing latest smoke regressions history compare check at ${textPath}. Run social-recovery:smoke:export first.`,
  previousMissingMessage: () => "",
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    latestDir: saved.latestDir,
    checkPath: saved.textPath,
    checkJsonPath: saved.jsonPath,
    check: saved.artifact,
    text: saved.text,
  },
});
