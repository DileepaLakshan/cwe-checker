// CommonJS duplicate of model-registry-logic.js for node:test (see
// src/cweLocationUtils.cjs for the same pattern) - package.json has no
// "type": "module", so the ESM source used by the Vite-bundled app can't be
// require()'d directly here.
function modelFileFor(characteristic) {
  return `${characteristic}_random_forest_model.pkl`;
}

function emptyEntry() {
  return { production: null, history: [], staging: [] };
}

function archiveCurrentProduction(entry, characteristic, timestamp) {
  if (!entry.production || !entry.production.file) return { history: entry.history, archive: null };

  const archivedFile = `${characteristic}__${entry.production.id}.pkl`;
  const archivedRecord = { ...entry.production, file: archivedFile, replacedAt: timestamp };
  return {
    history: archivedRecord,
    archive: { fromFile: entry.production.file, toFile: archivedFile, record: archivedRecord },
  };
}

function applyPromote(entry, characteristic, runId, now = () => new Date().toISOString()) {
  const candidate = entry.staging.find((s) => s.id === runId);
  if (!candidate) {
    throw new Error(`No staged candidate '${runId}' found for '${characteristic}'`);
  }

  const { history: archivedRecord, archive } = archiveCurrentProduction(entry, characteristic, now());

  const next = {
    production: {
      id: candidate.id,
      trainedAt: candidate.trainedAt,
      metrics: candidate.metrics,
      source: 'trained',
      file: modelFileFor(characteristic),
    },
    history: archive ? [archivedRecord, ...entry.history] : entry.history.slice(),
    staging: entry.staging.filter((s) => s.id !== runId),
  };

  return { entry: next, archive, candidateFile: candidate.file };
}

function applyRestore(entry, characteristic, versionId, now = () => new Date().toISOString()) {
  const versionIndex = entry.history.findIndex((v) => v.id === versionId);
  if (versionIndex === -1) {
    throw new Error(`No archived version '${versionId}' found for '${characteristic}'`);
  }
  const version = entry.history[versionIndex];
  const historyWithoutRestored = entry.history.filter((_, i) => i !== versionIndex);

  const { history: archivedRecord, archive } = archiveCurrentProduction(entry, characteristic, now());

  const next = {
    production: {
      id: version.id,
      trainedAt: version.trainedAt,
      metrics: version.metrics,
      source: version.source || 'trained',
      file: modelFileFor(characteristic),
    },
    history: archive ? [...historyWithoutRestored, archivedRecord] : historyWithoutRestored,
    staging: entry.staging.slice(),
  };

  return { entry: next, archive, versionFile: version.file };
}

function applyDiscard(entry, runId) {
  return { ...entry, staging: entry.staging.filter((s) => s.id !== runId) };
}

module.exports = { modelFileFor, emptyEntry, applyPromote, applyRestore, applyDiscard };
