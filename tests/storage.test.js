import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { readJson, writeJsonAtomic, ensureDir } from '../src/services/storage.js';

describe('Storage Service (Atomic Persistence & Recovery)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'linguagate-storage-test-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should return default value when file does not exist', () => {
    const filePath = join(tempDir, 'nonexistent.json');
    const defaultData = { xp: 100 };
    const result = readJson(filePath, defaultData);
    assert.deepEqual(result, defaultData);
  });

  test('should atomically write and read JSON data', () => {
    const filePath = join(tempDir, 'data.json');
    const data = { user: 'Tester', level: 'B2', completed: [1, 2, 3] };

    writeJsonAtomic(filePath, data);

    assert.ok(existsSync(filePath));
    const result = readJson(filePath, {});
    assert.deepEqual(result, data);
  });

  test('should create backup file (.bak) on subsequent writes', () => {
    const filePath = join(tempDir, 'state.json');
    const backupPath = `${filePath}.bak`;

    writeJsonAtomic(filePath, { version: 1 });
    assert.ok(existsSync(filePath));
    assert.ok(!existsSync(backupPath), 'Backup should not exist on first write');

    writeJsonAtomic(filePath, { version: 2 });
    assert.ok(existsSync(backupPath), 'Backup should exist on second write');

    const backupContent = JSON.parse(readFileSync(backupPath, 'utf-8'));
    assert.deepEqual(backupContent, { version: 1 });

    const currentContent = readJson(filePath, {});
    assert.deepEqual(currentContent, { version: 2 });
  });

  test('should recover from corrupted main JSON using .bak backup', () => {
    const filePath = join(tempDir, 'resilient.json');
    const backupPath = `${filePath}.bak`;

    // 1. Initial valid write
    writeJsonAtomic(filePath, { status: 'healthy', value: 42 });
    // 2. Second valid write creates the backup with { status: 'healthy', value: 42 }
    writeJsonAtomic(filePath, { status: 'healthy_v2', value: 43 });

    // 3. Intentionally corrupt the primary file (e.g. partial disk write / sudden termination)
    writeFileSync(filePath, '{ invalid json partial write...', 'utf-8');

    // 4. Reading should automatically recover the backup
    const recovered = readJson(filePath, { status: 'default' });
    assert.deepEqual(recovered, { status: 'healthy', value: 42 });
  });

  test('should fallback to default when both main and backup are invalid', () => {
    const filePath = join(tempDir, 'total_loss.json');
    const backupPath = `${filePath}.bak`;

    writeFileSync(filePath, 'corrupted', 'utf-8');
    writeFileSync(backupPath, 'also corrupted', 'utf-8');

    const fallback = { fallback: true };
    const result = readJson(filePath, fallback);
    assert.deepEqual(result, fallback);
  });
});
