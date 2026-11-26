/**
 * Tiny JSON-file data store.
 *
 * Seed content (news, events, teachers, gallery, stats) lives in server/data/*.json
 * and is committed to the repo. Form submissions are appended to JSON files under
 * server/data/runtime/ which are gitignored (they contain personal data).
 */
const fs = require('fs');
const path = require('path');

const SEED_DIR = path.join(__dirname, 'data');
const RUNTIME_DIR = path.join(SEED_DIR, 'runtime');

function readSeed(name) {
  const file = path.join(SEED_DIR, `${name}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[store] Could not read seed file ${file}:`, err.message);
    return [];
  }
}

function runtimeFile(name) {
  return path.join(RUNTIME_DIR, `${name}.json`);
}

function readRuntime(name) {
  const file = runtimeFile(name);
  try {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[store] Could not read runtime file ${file}:`, err.message);
    return [];
  }
}

// NOTE on concurrency: every operation in this module is synchronous by
// design. appendRuntime's read -> push -> write runs as one uninterruptible
// block on Node's single thread, so concurrent requests in this process
// cannot interleave and lose records. Do NOT convert these helpers to async
// fs calls without adding a serialisation queue first — that would
// introduce exactly the race this design avoids.
function appendRuntime(name, record) {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const items = readRuntime(name);
  items.push(record);
  fs.writeFileSync(runtimeFile(name), JSON.stringify(items, null, 2), 'utf8');
  return record;
}

module.exports = { readSeed, readRuntime, appendRuntime };
