import test from 'node:test';
import assert from 'node:assert/strict';
import {dockerSmokeArgs,main} from './pdf-local-runtime-audit.mjs';
const sha='a'.repeat(40);
test('smoke is air-gapped, bounded to 1 CPU/2GiB and read-only',()=>{
  const a=dockerSmokeArgs(sha,'D:\\Code\\teacher-hub\\workers\\pdf\\test');
  assert(a.includes('--network')&&a.includes('none'));
  assert(a.includes('--cpus=1')&&a.includes('--memory=2g'));
  assert(a.includes('--read-only')&&a.includes('--cap-drop=ALL'));
  assert(a.at(-3).endsWith(':'+sha));
  assert.equal(a.some(x=>/push|pull|deploy|set-iam/.test(x)),false);
  assert.throws(()=>dockerSmokeArgs('invalid','test'),/STAGED_SHA_REQUIRED/);
  assert.throws(()=>dockerSmokeArgs(sha,'bad\npath'),/INVALID_TEST_PATH/);
});
test('only --smoke can start local Docker, once',()=>{
  let calls=0;
  const run=(cmd,args)=>{calls++;assert.equal(cmd,'docker');assert(args.includes('--network'));};
  assert.equal(main(['--delete'],{PDF_STAGED_SHA:sha},run),2);
  assert.equal(calls,0);
  assert.equal(main(['--smoke'],{PDF_STAGED_SHA:sha},run),0);
  assert.equal(calls,1);
});
