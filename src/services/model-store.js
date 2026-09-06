import { app } from 'electron';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { applyDiscard, applyPromote, applyRestore } from './model-registry-logic';

// The packaged ml_models/ folder is read-only (it ships inside the app's
// resources/asar), so trained/promoted models live in a writable mirror
// under userData instead. predict.py is always pointed at getProductionDir().
function getWritableRoot() {
  return path.join(app.getPath('userData'), 'ml-models');
}

function getBundledModelsDir() {
  return path.join(app.getAppPath(), 'ml_models');
}

export function getProductionDir() {
  return path.join(getWritableRoot(), 'production');
}

function getVersionsDir() {
  return path.join(getWritableRoot(), 'versions');
}

export function getStagingDir(runId) {
  return path.join(getWritableRoot(), 'staging', runId);
}

function getRegistryPath() {
  return path.join(getWritableRoot(), 'registry.json');
}

async function readRegistry() {
  const registryPath = getRegistryPath();
  if (!existsSync(registryPath)) {
    return { characteristics: {} };
  }
  try {
    const raw = await fs.readFile(registryPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading model registry, starting fresh:', err);
    return { characteristics: {} };
  }
}

async function writeRegistry(registry) {
  await fs.mkdir(getWritableRoot(), { recursive: true });
  await fs.writeFile(getRegistryPath(), JSON.stringify(registry, null, 2), 'utf-8');
}

// One-time migration: seed the writable production dir from the models
// shipped with the app, and record them in the registry, so existing
// behavior (predict.py finding the 7 bundled models) is unchanged until the
// user actually promotes something. Exported so scan-handlers.js can seed
// on first live prediction too, not just when the training UI is opened.
export async function ensureSeeded() {
  const productionDir = getProductionDir();
  await fs.mkdir(productionDir, { recursive: true });

  const existing = await fs.readdir(productionDir);
  if (existing.length > 0) {
    return;
  }

  const bundledDir = getBundledModelsDir();
  if (!existsSync(bundledDir)) {
    return;
  }

  const bundledFiles = (await fs.readdir(bundledDir)).filter((f) => f.endsWith('.pkl'));
  const registry = await readRegistry();

  for (const file of bundledFiles) {
    await fs.copyFile(path.join(bundledDir, file), path.join(productionDir, file));
    const characteristic = file.replace(/_random_forest_model\.pkl$/i, '');
    registry.characteristics[characteristic] = {
      production: { id: 'seed', trainedAt: null, metrics: null, source: 'bundled', file },
      history: [],
      staging: [],
    };
  }

  await writeRegistry(registry);
}

function ensureCharacteristicEntry(registry, characteristic) {
  if (!registry.characteristics[characteristic]) {
    registry.characteristics[characteristic] = { production: null, history: [], staging: [] };
  }
  return registry.characteristics[characteristic];
}

export async function listRegistry() {
  await ensureSeeded();
  const registry = await readRegistry();
  return registry.characteristics;
}

// Called by training-handlers.js once run_pipeline.py reports a successful
// "train_model" result for a characteristic, so the candidate survives
// (and is browsable) even if the app is closed before the user applies it.
export async function recordStaged(runId, characteristic, modelFile, metrics) {
  const registry = await readRegistry();
  const entry = ensureCharacteristicEntry(registry, characteristic);

  const candidate = {
    id: runId,
    file: modelFile,
    trainedAt: new Date().toISOString(),
    metrics,
  };

  entry.staging = entry.staging.filter((s) => s.id !== runId);
  entry.staging.push(candidate);

  await writeRegistry(registry);
  return candidate;
}

export async function promote(characteristic, runId) {
  await ensureSeeded();
  const registry = await readRegistry();
  const entry = ensureCharacteristicEntry(registry, characteristic);

  const { entry: nextEntry, archive, candidateFile } = applyPromote(entry, characteristic, runId);

  const productionDir = getProductionDir();
  const versionsDir = getVersionsDir();
  await fs.mkdir(productionDir, { recursive: true });
  await fs.mkdir(versionsDir, { recursive: true });

  if (archive && existsSync(path.join(productionDir, archive.fromFile))) {
    await fs.copyFile(path.join(productionDir, archive.fromFile), path.join(versionsDir, archive.toFile));
  }

  const stagedPath = path.join(getStagingDir(runId), candidateFile);
  await fs.copyFile(stagedPath, path.join(productionDir, nextEntry.production.file));

  registry.characteristics[characteristic] = nextEntry;
  await writeRegistry(registry);
  return nextEntry.production;
}

export async function discard(characteristic, runId) {
  const registry = await readRegistry();
  const entry = ensureCharacteristicEntry(registry, characteristic);
  registry.characteristics[characteristic] = applyDiscard(entry, runId);
  await writeRegistry(registry);

  const stagingDir = getStagingDir(runId);
  if (existsSync(stagingDir)) {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }
}

export async function restore(characteristic, versionId) {
  await ensureSeeded();
  const registry = await readRegistry();
  const entry = ensureCharacteristicEntry(registry, characteristic);

  const { entry: nextEntry, archive, versionFile } = applyRestore(entry, characteristic, versionId);

  const productionDir = getProductionDir();
  const versionsDir = getVersionsDir();
  await fs.mkdir(productionDir, { recursive: true });
  await fs.mkdir(versionsDir, { recursive: true });

  if (archive && existsSync(path.join(productionDir, archive.fromFile))) {
    await fs.copyFile(path.join(productionDir, archive.fromFile), path.join(versionsDir, archive.toFile));
  }

  await fs.copyFile(path.join(versionsDir, versionFile), path.join(productionDir, nextEntry.production.file));

  registry.characteristics[characteristic] = nextEntry;
  await writeRegistry(registry);
  return nextEntry.production;
}

export function generateRunId() {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
}
