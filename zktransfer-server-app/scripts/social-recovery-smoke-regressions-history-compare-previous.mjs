import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "previous",
  textFileName: "regressions-history-compare.txt",
  jsonFileName: "regressions-history-compare.json",
  latestMissingMessage: () => "",
  previousMissingMessage: (textPath) =>
    `Missing previous smoke regressions history compare at ${textPath}. Run social-recovery:smoke:export again after another smoke run.`,
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    latestDir: saved.latestDir,
    snapshot: saved.snapshot,
    comparePath: saved.textPath,
    compareJsonPath: saved.jsonPath,
    compare: saved.artifact,
    text: saved.text,
  },
});
