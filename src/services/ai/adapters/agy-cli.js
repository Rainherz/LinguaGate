import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const AGY_TIMEOUT_MS = 180_000;

/**
 * Runs a command to completion without blocking the event loop.
 * The previous implementation used execSync, which froze every ora spinner
 * for the full duration of the call.
 */
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`${cmd} timed out after ${AGY_TIMEOUT_MS / 1000}s.`));
    }, AGY_TIMEOUT_MS);

    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${cmd} exited with code ${code}.`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Adapter for the `agy` agent CLI.
 * Uses --json-schema so the CLI enforces the shape server-side and returns it
 * in `structured_output`, removing the need to scrape JSON out of prose.
 * @param {{ cmd?: string }} [options]
 */
export function createAgyProvider(options = {}) {
  const cmd = options.cmd || 'agy';

  return {
    name: 'agy',
    async complete({ prompt, schema }) {
      if (!schema) {
        const raw = await run(cmd, [`--print=${prompt}`]);
        return { text: raw.trim() };
      }

      const dir = mkdtempSync(join(tmpdir(), 'linguagate-agy-'));
      const schemaPath = join(dir, 'schema.json');

      try {
        writeFileSync(schemaPath, JSON.stringify(schema));
        const raw = await run(cmd, [
          `--print=${prompt}`,
          `--json-schema=${schemaPath}`,
          '--output-format=json'
        ]);

        const envelope = JSON.parse(raw);
        if (envelope.structured_output !== undefined) {
          return { data: envelope.structured_output };
        }
        // Older CLI builds without structured_output: fall back to text parsing.
        return { text: envelope.response ?? raw };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}
