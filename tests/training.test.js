const test = require('node:test');
const assert = require('node:assert/strict');
const { NdjsonReader } = require('../src/utils/ndjson.cjs');
const { emptyEntry, applyPromote, applyRestore, applyDiscard, modelFileFor } = require('../src/services/model-registry-logic.cjs');

test('NdjsonReader parses complete lines and holds back partial ones', () => {
  const reader = new NdjsonReader();

  let events = reader.push('{"stage":"value_report","status":"running"}\n{"stage":"value_report"');
  assert.deepEqual(events, [{ stage: 'value_report', status: 'running' }]);

  events = reader.push(',"status":"done","repo_count":3}\n');
  assert.deepEqual(events, [{ stage: 'value_report', status: 'done', repo_count: 3 }]);
});

test('NdjsonReader skips malformed lines instead of throwing', () => {
  const reader = new NdjsonReader();
  const events = reader.push('not json\n{"stage":"complete","results":{}}\n');
  assert.deepEqual(events, [{ stage: 'complete', results: {} }]);
});

test('applyPromote moves a staged candidate to production and archives nothing when there is no prior model', () => {
  const entry = emptyEntry();
  entry.staging.push({ id: 'run-1', file: 'security_random_forest_model.pkl', trainedAt: '2026-01-01T00:00:00.000Z', metrics: { r2: 0.8 } });

  const { entry: next, archive, candidateFile } = applyPromote(entry, 'Security', 'run-1');

  assert.equal(archive, null);
  assert.equal(candidateFile, 'security_random_forest_model.pkl');
  assert.equal(next.production.id, 'run-1');
  assert.equal(next.production.file, modelFileFor('Security'));
  assert.deepEqual(next.staging, []);
  assert.deepEqual(next.history, []);
});

test('applyPromote archives the current production model before replacing it', () => {
  const entry = {
    production: { id: 'seed', trainedAt: null, metrics: null, source: 'bundled', file: 'security_random_forest_model.pkl' },
    history: [],
    staging: [{ id: 'run-2', file: 'security_random_forest_model.pkl', trainedAt: '2026-02-01T00:00:00.000Z', metrics: { r2: 0.9 } }],
  };

  const { entry: next, archive } = applyPromote(entry, 'Security', 'run-2', () => '2026-02-01T00:00:00.000Z');

  assert.equal(archive.fromFile, 'security_random_forest_model.pkl');
  assert.equal(archive.toFile, 'Security__seed.pkl');
  assert.equal(next.production.id, 'run-2');
  assert.equal(next.history.length, 1);
  assert.equal(next.history[0].id, 'seed');
  assert.equal(next.history[0].file, 'Security__seed.pkl');
});

test('applyPromote throws for an unknown staged run id', () => {
  const entry = emptyEntry();
  assert.throws(() => applyPromote(entry, 'Security', 'missing-run'), /No staged candidate/);
});

test('applyRestore brings back an archived version and re-archives the one it replaces', () => {
  const entry = {
    production: { id: 'run-2', trainedAt: '2026-02-01T00:00:00.000Z', metrics: { r2: 0.9 }, source: 'trained', file: 'Security_random_forest_model.pkl' },
    history: [{ id: 'seed', trainedAt: null, metrics: null, source: 'bundled', file: 'Security__seed.pkl', replacedAt: '2026-02-01T00:00:00.000Z' }],
    staging: [],
  };

  const { entry: next, archive, versionFile } = applyRestore(entry, 'Security', 'seed', () => '2026-03-01T00:00:00.000Z');

  assert.equal(versionFile, 'Security__seed.pkl');
  assert.equal(next.production.id, 'seed');
  assert.equal(archive.fromFile, 'Security_random_forest_model.pkl');
  // The version just restored is gone from history; the one it replaced took its place.
  assert.equal(next.history.length, 1);
  assert.equal(next.history[0].id, 'run-2');
});

test('applyRestore throws for an unknown archived version id', () => {
  const entry = emptyEntry();
  assert.throws(() => applyRestore(entry, 'Security', 'missing-version'), /No archived version/);
});

test('applyDiscard only removes the matching staged candidate', () => {
  const entry = emptyEntry();
  entry.staging.push({ id: 'run-1', file: 'a.pkl' }, { id: 'run-2', file: 'b.pkl' });

  const next = applyDiscard(entry, 'run-1');

  assert.deepEqual(next.staging.map((s) => s.id), ['run-2']);
});
