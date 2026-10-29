import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import changes from './pdf-worker-changes.cjs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8').replaceAll('\r\n','\n');
const workflow = read('.github/workflows/pdf-worker-release.yml');

test('PDF release installs the pinned npm before npm ci, matching primary CI',()=>{
  const primary = read('.github/workflows/ci.yml');
  const pkg = JSON.parse(read('package.json'));
  const version = pkg.packageManager.match(/^npm@(\\d+\\.\\d+\\.\\d+)$/)?.[1];
  assert(version, 'packageManager must pin npm');
  const pin = 'npm install -g npm@' + version;
  assert(primary.includes(pin), 'main CI must use pinned npm');
  const setup = workflow.indexOf('      - uses: actions/setup-node@v6');
  const install = workflow.indexOf('      - name: Install pinned npm for PDF Worker release');
  const installCommand = workflow.indexOf('        run: ' + pin, install);
  const ci = workflow.indexOf('          npm ci', install);
  assert(setup >= 0 && install > setup && installCommand > install && ci > installCommand,
    'npm must be upgraded after setup-node and before npm ci');
});

test('staging never promotes, mutates IAM, or deploys Gateway; reports staging explicitly',()=>{
  assert.doesNotMatch(workflow,/update-traffic|set-iam-policy|add-iam-policy-binding|allow-unauthenticated/);
  assert.match(workflow,/--no-traffic --tag=pdf-ci/);
  assert.doesNotMatch(workflow,/gcloud run deploy.*gateway/);
  assert.match(workflow,/Workflow success means staging only/);
  assert.match(workflow,/Recheck candidate and unchanged production traffic after smoke/);
});
test('image is bound to build output and registry digest, root context and exact source',()=>{
  assert.match(workflow,/ref: \$\{\{ inputs.source_sha \}\}/);
  assert.match(workflow,/git rev-parse HEAD/);
  assert.match(workflow,/--file workers\/pdf\/Dockerfile.*--push \./);
  assert.match(workflow,/--metadata-file/);
  assert.match(workflow,/test "\$d" = "\$built"/);
  assert.match(workflow,/--image="\$REGISTRY\/\$WORKER@\$IMAGE_DIGEST"/);
  const describe=workflow.split('\n').find(l=>l.includes('gcloud artifacts docker images describe'));
  assert.doesNotMatch(describe,/--location/);
});
test('deploy protection precedes WIF, tokens use service audience and readiness receives managed mode',()=>{
  assert(workflow.indexOf('.release(github, context)') < workflow.indexOf('uses: google-github-actions/auth'));
  assert.match(workflow,/token_format: id_token/);
  assert.match(workflow,/id_token_audience: https:\/\/teacher-pdf-worker-851777150171.asia-southeast1.run.app/);
  assert.match(workflow,/ID_TOKEN: \$\{\{ steps.smoke-auth.outputs.id_token \}\}/);
  assert.match(read('.github/workflows/pdf-worker.yml'),/PDF_WORKER_AUTO_DEPLOY_ENABLED: \$\{\{ vars.PDF_WORKER_AUTO_DEPLOY_ENABLED \}\}/);
});
test('registry cleanup runs only after staged candidate and separate opt-in',()=>{
  const afterStage=workflow.indexOf('Publish staged candidate for operator verification');
  const preview=workflow.indexOf('Preview obsolete Artifact Registry images');
  const apply=workflow.indexOf('Cleanup obsolete Artifact Registry images when separately enabled');
  assert(afterStage>=0 && preview>afterStage && apply>preview);
  assert.match(workflow,/if: \$\{\{ vars\.PDF_REGISTRY_CLEANUP_ENABLED == 'true' \}\}/);
  assert.match(workflow,/node scripts\/pdf-registry-cleanup\.mjs --dry-run/);
  assert.match(workflow,/node scripts\/pdf-registry-cleanup\.mjs --apply/);
});
test('generated WIF credential files stay out of Git and Docker context',()=>{
  for(const file of ['.gitignore','.dockerignore']) assert.match(read(file),/^gha-creds-\*\.json$/m,file);
});
test('main deliveries do not cancel each other, bootstrap runs CI and Worker waits for API delivery',()=>{
  const ci=read('.github/workflows/ci.yml');
  assert.match(ci,/cancel-in-progress: \$\{\{ github.ref != 'refs\/heads\/main' \}\}/);
  assert.match(ci,/workflow_dispatch:\s+inputs:\s+force_worker_release:/);
  assert.match(ci,/needs:\s+- deploy-production\s+- pdf-worker-changes/);
});

test('manual CI cannot publish API/Web; bootstrap is explicit, opt-in and main-only',()=>{
  const ci=read('.github/workflows/ci.yml');
  const job=name=>ci.split('\n  '+name+':\n')[1].split(/\n  [a-z-]+:\n/)[0];
  const conditions=['deploy-production','pdf-worker-changes','deploy-pdf-worker'].map(name=>
    job(name).match(/^    if: \$\{\{ (.+) \}\}$/m)[1]
      .replaceAll('needs.pdf-worker-changes','needs["pdf-worker-changes"]'));
  for(const event_name of ['push','workflow_dispatch','pull_request']) {
    for(const force of [undefined,false,true]) for(const enabled of ['false','true']) {
      for(const ref of ['refs/heads/main','refs/heads/feature','refs/tags/main']) {
        for(const repository of ['hoangbao179/teacher-hub','fork/teacher-hub']) {
          const trusted=repository==='hoangbao179/teacher-hub' && ref==='refs/heads/main';
          const requested=event_name==='push'||(event_name==='workflow_dispatch'&&force===true&&enabled==='true');
          const ctx={github:{event_name,ref,repository},inputs:{force_worker_release:force},
            vars:{PDF_WORKER_AUTO_DEPLOY_ENABLED:enabled},needs:{'pdf-worker-changes':{outputs:{changed:'true'}}}};
          conditions.forEach((condition,i)=>assert.equal(Boolean(runInNewContext(condition,ctx)),
            trusted&&requested&&(i===0||enabled==='true'),JSON.stringify({event_name,force,enabled,ref,repository,i})));
        }
      }
    }
  }
  assert.match(job('deploy-production'),/needs:\s+- quality\s+- integration\s+- e2e-smoke\s+- schedule-regression/);
  assert.match(job('deploy-production'),/uses: \.\/\.github\/workflows\/deploy.yml/);
});

test('stage metadata contract names the guarded release job and every required gate',()=>{
  const ci=read('.github/workflows/ci.yml');
  const caller=ci.split('\n  deploy-pdf-worker:\n')[1].match(/    name: (.+)/)[1];
  assert.equal(changes.stageJobName,caller+' / release');
  for(const name of changes.stageSteps) assert(workflow.includes('      - name: '+name+'\n'),name);
  assert(!changes.paths.includes('.github/workflows/ci.yml'));
});

// Execute the actual workflow shell, with every external mutation replaced by
// a local function. No Docker daemon, credentials or network is used.
test('build/push/digest/deploy/health failures stop staging without touching traffic', t => {
  const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash';
  assert(existsSync(bash) || process.platform!=='win32','Git Bash required for shell regression');
  const dir=mkdtempSync(join(tmpdir(),'pdf-stage-shell-')).replaceAll('\\','/');
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const names=['Build single-platform immutable image','Resolve manifest digest','Stage zero-traffic canary','Authenticated canary smoke'];
  const blocks=names.map(name=>{
    const step=workflow.split('      - name: '+name+'\n')[1]?.split(/\n      - /)[0];
    const block=step?.split('        run: |\n')[1];
    assert(block,name);
    return block.split('\n').map(l=>l.startsWith('          ')?l.slice(10):l).join('\n');
  });
  const mocks=`
    docker() {
      echo docker >> "$CALLS"
      [[ "$FAIL" != build && "$FAIL" != push ]] || return 31
      command node -e 'require("fs").writeFileSync(process.env.RUNNER_TEMP+"/worker-build.json", JSON.stringify({"containerimage.digest":process.env.IMAGE_DIGEST}))'
    }
    gcloud() {
      echo "gcloud $*" >> "$CALLS"
      if [[ "$*" == artifacts* ]]; then
        [[ "$FAIL" != registry ]] || return 32
        if [[ "$FAIL" == digest ]]; then echo invalid; elif [[ "$FAIL" == mismatch ]]; then echo "sha256:$(printf 'c%.0s' {1..64})"; else echo "$IMAGE_DIGEST"; fi
      elif [[ "$*" == 'run deploy'* ]]; then
        [[ "$FAIL" != deploy ]] || return 33
      else return 99; fi
    }
    curl() {
      echo curl >> "$CALLS"
      [[ "$FAIL" != health ]] || return 22
      if [[ "$FAIL" == healthbody ]]; then echo '{"status":"bad"}'; else echo '{"status":"ok"}'; fi
    }
  `;
  for(const fail of ['build','push','registry','digest','mismatch','deploy','health','healthbody','none']) {
    const calls=join(dir,'calls-'+fail);
    const result=spawnSync(bash,['--noprofile','--norc','-e','-o','pipefail','-c',mocks+'\n'+blocks.join('\n')],{
      encoding:'utf8',env:{...process.env,FAIL:fail,CALLS:calls,RUNNER_TEMP:dir,GITHUB_OUTPUT:join(dir,'output'),
        SOURCE_SHA:'a'.repeat(40),IMAGE_DIGEST:'sha256:'+'b'.repeat(64),CLOUD_PROJECT:'synthetic',CLOUD_REGION:'synthetic',
        REGISTRY:'example.invalid/synthetic',WORKER:'synthetic',ID_TOKEN:'synthetic-token',CANARY_URL:'https://example.invalid'},
    });
    assert.equal(result.status===0,fail==='none',fail+': '+result.stderr);
    const commands=readFileSync(calls,'utf8');
    assert.doesNotMatch(commands,/update-traffic|gateway|iam-policy/);
    if(['build','push','registry','digest','mismatch'].includes(fail)) assert.doesNotMatch(commands,/run deploy/);
    if(['deploy','build','push','registry','digest','mismatch'].includes(fail)) assert.doesNotMatch(commands,/curl/);
  }
});
