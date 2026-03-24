import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "latest",
  textFileName: "regressions-history-compare.txt",
  jsonFileName: "regressions-history-compare.json",
  latestMissingMessage: (textPath) =>
    `Missing latest smoke regressions history compare at ${textPath}. Run social-recovery:smoke:export first.`,
  previousMissingMessage: () => "",
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    latestDir: saved.latestDir,
    comparePath: saved.textPath,
    compareJsonPath: saved.jsonPath,
    compare: saved.artifact,
    text: saved.text,
  },
});
