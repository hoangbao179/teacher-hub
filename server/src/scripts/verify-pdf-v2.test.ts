import test from 'node:test';
import assert from 'node:assert/strict';
import type { RowDataPacket } from 'mysql2/promise';
import { validatePdfSchema } from './verify-pdf-v2';

const rows = () => [
  { name: 'worker_version', type: 'tinyint unsigned', nullable: 'NO', value: '1' },
  { name: 'progress_json', type: 'json', nullable: 'YES', value: null },
] as unknown as RowDataPacket[];
test('activation requires ledger plus real additive schema with v1 default', () => {
  const ledger = [{version:'0029_pdf_chunk_progress.sql'}] as RowDataPacket[];
  validatePdfSchema(ledger, rows());
  assert.throws(() => validatePdfSchema([], rows()), /SCHEMA_UNVERIFIED/);
  assert.throws(() => validatePdfSchema(ledger, rows().slice(0, 1)), /SCHEMA_UNVERIFIED/);
  for (const [index, field, value] of [[0, 'value', '2'], [0, 'nullable', 'YES'],
    [0, 'type', 'int'], [1, 'type', 'text'], [1, 'nullable', 'NO']] as const) {
    const columns = rows(); columns[index][field] = value;
    assert.throws(() => validatePdfSchema(ledger, columns), /SCHEMA_UNVERIFIED/);
  }
});
