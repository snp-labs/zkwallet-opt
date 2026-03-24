import {
  getCliContext,
  loadSavedArtifact,
  printSavedArtifact,
} from "./social-recovery-smoke-saved-artifact-core.mjs";

const context = getCliContext(import.meta.url);
const saved = loadSavedArtifact({
  importMetaUrl: import.meta.url,
  mode: "previous",
  textFileName: "regressions-next.txt",
  latestMissingMessage: () => "",
  previousMissingMessage: (textPath) =>
    `Missing previous snapshot regressions next artifact at ${textPath}.`,
  snapshotMissingMessage: () => "",
});

printSavedArtifact({
  jsonOnly: context.jsonOnly,
  payload: {
    baseDir: saved.baseDir,
    snapshot: saved.snapshot,
    nextPath: saved.textPath,
    command: saved.text.trim(),
    text: saved.text,
  },
});
