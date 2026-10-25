import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = readFileSync(new URL('../deploy/nginx.conf', import.meta.url), 'utf8');

test('Nginx behind HTTPS Caddy never emits absolute redirects with internal :8080', () => {
  assert.match(config, /^\s*absolute_redirect off;\s*$/m);
  assert.match(config, /location = \/tools\s*\{\s*return 308 \/tools\/;\s*\}/);
  assert.doesNotMatch(config, /return\s+30[178]\s+https?:\/\//);
});

test('public SPA /tools remains backed by prerendered directory', () => {
  assert.match(config, /root \/usr\/share\/nginx\/html;/);
  assert.match(config, /location \/\s*\{\s*try_files \$uri \$uri\/ =404;/);
});
