// Incrementally splits a stream of text chunks into complete lines and
// parses each as JSON. Used to turn run_pipeline.py's NDJSON stdout into
// progress events as they arrive - one JSON object per line, per the
// contract documented at the top of ml_models/training/run_pipeline.py.
export class NdjsonReader {
  constructor() {
    this.buffer = '';
  }

  // Feed a chunk of decoded text; returns an array of parsed JSON objects
  // for every complete line seen so far. Malformed lines are skipped rather
  // than thrown, since a stray non-JSON stdout write shouldn't take down an
  // otherwise-healthy training run.
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
