import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
test('PDF host secrets survive deployment and are excluded from image/repository', () => {
  for (const file of ['docker-compose.deploy.yml', 'docker-compose.prod.yml']) {
    const compose = read(file);
    assert.match(compose, /path: \.\/pdf-runtime\/runtime.env\s+required: false/);
    assert.match(compose, /\.\/pdf-runtime:\/run\/teacher-pdf:ro/);
    assert.match(compose, /PDF_GATEWAY_APPROVAL_FILE: \/run\/teacher-pdf\/approval.json/);
    assert.doesNotMatch(compose, /PDF_API_ENABLED:.*true|hmacKeyHex|private_key/);
  }
  const deploy = read('docker-compose.deploy.yml');
  const api = deploy.split('\n  api:')[1].split('\n  web:')[0];
  assert.match(api, /networks:\s+- backend\s+- pdf-egress/);
  assert.match(api, /mem_limit: 384m/);
  for (const file of ['.gitignore', '.dockerignore']) assert.match(read(file), /^pdf-runtime\/?$/m);
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(workflow, /scripts\/pdf-recovery.sh scripts\/teacher-pdf-recovery.service scripts\/teacher-pdf-recovery.timer/);
  assert.doesNotMatch(workflow, /PDF_API_ENABLED:.*true|secrets\.PDF_GATEWAY_HMAC|secrets\.PDF_SUBJECT/);
});
test('recovery runs once a minute inside existing API with lock and bounded process', () => {
  assert.match(read('scripts/teacher-pdf-recovery.timer'), /OnCalendar=\*-\*-\* \*:\*:00/);
  assert.match(read('scripts/teacher-pdf-recovery.service'), /TimeoutStartSec=55/);
  const script = read('scripts/pdf-recovery.sh');
  assert.match(script, /flock -n 9/);
  assert.match(script, /exec -T/);
  assert.match(script, /api node --max-old-space-size=64 dist\/scripts\/reconcile-pdf.js/);
  assert.doesNotMatch(script, /compose.*run|gcloud|curl|printenv/);
});
