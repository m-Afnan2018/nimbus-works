/**
 * Demo reset: wipe + re-seed the demo databases once, then exit.
 *
 *   node scheduler.js             seed now
 *   node scheduler.js --now       same (kept for the README / muscle memory)
 *   node scheduler.js --if-empty  seed only if the Workspace DB has no users
 *
 * The daily timing lives in run.sh, which just sleeps in a shell, so no Node
 * process sits in memory between resets (this stack targets a 512 MB VPS).
 * Seeds run as child processes so each gets fresh Mongoose connections.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const log = (...a) => console.log(new Date().toISOString(), '[reset]', ...a);

function runSeeds() {
  log('Re-seeding demo data…');
  execFileSync('node', ['dist/scripts/seed.js'], {
    cwd: path.join(__dirname, 'workspace'), stdio: 'inherit', env: process.env,
  });
  execFileSync('node', ['dist/seed.js'], {
    cwd: path.join(__dirname, 'finance'),
    stdio: 'inherit',
    env: { ...process.env, MONGO_URI: process.env.FINANCE_MONGO_URI, SHARED_MONGO_URI: process.env.MONGO_URI },
  });
  log('Done.');
}

async function dbIsEmpty() {
  const mongoose = require('./workspace/node_modules/mongoose');
  const conn = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  try {
    return (await conn.db.collection('users').countDocuments()) === 0;
  } finally {
    await conn.close();
  }
}

(async () => {
  try {
    if (process.argv.includes('--if-empty') && !(await dbIsEmpty())) {
      log('Database already has data — skipping initial seed.');
      return;
    }
    runSeeds();
  } catch (err) {
    log('Reset failed:', err.message);
    process.exitCode = 1;
  }
})();
