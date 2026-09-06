// Pure registry-mutation logic for promote/restore/discard, factored out of
// model-store.js so it's testable with plain node:test - model-store.js is
// the only place that touches Electron's `app` or the filesystem; this file
// only computes what the new registry entry should look like.

export function modelFileFor(characteristic) {
  return `${characteristic}_random_forest_model.pkl`;
}

export function emptyEntry() {
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

// Promotes a staged candidate (entry.staging) to production. Returns the new
// entry plus, if there was a previous production model, what to archive it
// as (model-store.js does the actual file copy).
export function applyPromote(entry, characteristic, runId, now = () => new Date().toISOString()) {
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

// Restores an archived version (entry.history) back to production. The
// version being replaced is itself archived, so restoring stays reversible.
export function applyRestore(entry, characteristic, versionId, now = () => new Date().toISOString()) {
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

export function applyDiscard(entry, runId) {
  return { ...entry, staging: entry.staging.filter((s) => s.id !== runId) };
}
