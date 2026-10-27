import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = new URL('../', import.meta.url);
const read = file => readFile(new URL(file,dir),'utf8');

test('Docker build context includes npm package manifests and runtime source', async () => {
  const ignore = (await read('.dockerignore')).split(/\r?\n/).map(s=>s.trim())
    .filter(s=>s && !s.startsWith('#'));
  const dockerfile = await read('Dockerfile');
  assert.equal(ignore[0],'*','deny by default for a bounded build context');
  for(const expected of ['!Dockerfile','!package.json','!package-lock.json',
    '!src/','!src/*.mjs','!src/*.ts'])
    assert.ok(ignore.includes(expected),'missing allowlist rule '+expected);
  assert.match(dockerfile,/COPY workers\/pdf\/package\.json workers\/pdf\/package-lock\.json \.\//);
  assert.match(dockerfile,/COPY workers\/pdf\/src\/ \.\/src\//);
  assert.match(dockerfile,/COPY shared\/dist/);
  for(const name of ['package.json','package-lock.json','src/server.mjs','src/renderer.ts'])
    assert.ok((await read(name)).length>0, 'missing Docker COPY input '+name);
  assert.ok(!ignore.includes('!node_modules'),'never copy host dependencies');
});
