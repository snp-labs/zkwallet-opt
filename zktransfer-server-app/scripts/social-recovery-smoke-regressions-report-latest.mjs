import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "latest",
  textFileName: "regressions-report.md",
  jsonFileName: "regressions-report.json",
  latestMissingMessage: (textPath) =>
    `Missing latest smoke regressions report at ${textPath}. Run social-recovery:smoke:export first.`,
  previousMissingMessage: () => "",
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    latestDir: saved.latestDir,
    reportPath: saved.textPath,
    reportJsonPath: saved.jsonPath,
    report: saved.artifact,
    text: saved.text,
  },
});
