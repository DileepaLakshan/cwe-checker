// CommonJS duplicate of ndjson.js for node:test (see src/cweLocationUtils.cjs
// for the same pattern) - package.json has no "type": "module", so the ESM
// source used by the Vite-bundled app can't be require()'d directly here.
class NdjsonReader {
  constructor() {
    this.buffer = '';
  }

  push(chunk) {
    this.buffer += chunk;
    const events = [];
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        events.push(JSON.parse(line));
      } catch (e) {
        // ignore stray non-JSON output
      }
    }
    return events;
  }
}

module.exports = { NdjsonReader };
