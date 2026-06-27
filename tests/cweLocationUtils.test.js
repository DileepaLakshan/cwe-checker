const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLocateResults, renderCweLocationResults } = require('../src/cweLocationUtils.cjs');

test('normalizeLocateResults unwraps payloads returned by the main process', () => {
  const payload = {
    results: {
      'CWE-79': [{ file: 'src/app.js', line: 10, message: 'XSS' }],
      'CWE-20': []
    },
    summary: { totalHits: 1 },
    metadata: { projectPath: '/tmp/project' }
  };

  const normalized = normalizeLocateResults(payload);

  assert.deepEqual(normalized['CWE-79'], payload.results['CWE-79']);
  assert.deepEqual(normalized['CWE-20'], []);
});

test('renderCweLocationResults handles wrapped locate results without throwing', () => {
  const payload = {
    results: {
      'CWE-79': [{ file: 'src/app.js', line: 10, message: 'XSS' }]
    },
    summary: { totalHits: 1 },
    metadata: { projectPath: '/tmp/project' }
  };

  const html = renderCweLocationResults(payload);

  assert.match(html, /cwe-location-hit/);
  assert.match(html, /src\/app\.js/);
});
