const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('./validate-pdf-environment.cjs');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const context = { repo: { owner: 'hoangbao179', repo: 'teacher-hub' }, ref: 'refs/heads/main', eventName: 'workflow_dispatch' };
function fixture() {
  return {
    env: { name: 'pdf-worker', protection_rules: [{ type: 'branch_policy' }], can_admins_bypass: false, deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } },
    policies: { total_count: 1, branch_policies: [{ id: 64168843, name: 'main', type: 'branch' }] },
  };
}
function client(f, failure, status = 403, environment = 'pdf-worker') {
  return { rest: { repos: {
    getEnvironment: async args => { assert.deepEqual(args, { ...context.repo, environment_name: environment }); if (failure === 'env') throw Object.assign(new Error('API failure'), { status }); return { data: f.env }; },
    listDeploymentBranchPolicies: async args => { assert.deepEqual(args, { ...context.repo, environment_name: environment }); if (failure === 'policies') throw Object.assign(new Error('API failure'), { status }); return { data: f.policies }; },
  } } };
}

test('release validates its own main-only environment before WIF and fails closed', async () => {
  for (const eventName of ['push','workflow_dispatch']) {
    const f=fixture(); f.env.name='pdf-worker-deploy';
    await validate.release(client(f,undefined,403,'pdf-worker-deploy'),{...context,eventName});
    for (const failure of ['env','policies']) {
      await assert.rejects(validate.release(client(f,failure,403,'pdf-worker-deploy'),{...context,eventName}));
    }
    f.policies.branch_policies[0].type='tag';
    await assert.rejects(validate.release(client(f,undefined,403,'pdf-worker-deploy'),{...context,eventName}));
    f.policies.branch_policies[0].type='branch'; f.env.can_admins_bypass=true;
    await assert.rejects(validate.release(client(f,undefined,403,'pdf-worker-deploy'),{...context,eventName}));
  }
  for (const override of [{eventName:'pull_request'},{ref:'refs/tags/main'},{repo:{owner:'other',repo:'teacher-hub'}}]) {
    await assert.rejects(validate.release({}, {...context,...override}),/Release WIF requires/);
  }
});
test('accepts main-only environment without reviewers for verifier workflow', async () => {
  const f = fixture();
  await validate(client(f), context);
  f.env.protection_rules = [];
  await validate(client(f), context);
  f.env.protection_rules = [{ type: 'required_reviewers', reviewers: [] }];
  await validate(client(f), context);
});

test('API denial and errors propagate before authentication', async () => {
  for (const failure of ['env', 'policies']) {
    for (const status of [403, 404, 500]) {
      await assert.rejects(validate(client(fixture(), failure, status), context), { status });
    }
  }
});
test('rejects unsafe, incomplete and malformed protection responses', async () => {
  for (const mutate of [
    f => { f.env = null; },
    f => { delete f.env.protection_rules; },
    f => { f.env.protection_rules = {}; },
    f => { f.env.name = 'other'; },
    f => { delete f.env.name; },
    f => { f.env.protection_rules = [null]; },
    f => { f.env.deployment_branch_policy.protected_branches = true; },
    f => { delete f.env.deployment_branch_policy.protected_branches; },
    f => { delete f.policies.branch_policies[0].type; },
    f => { f.env.can_admins_bypass = true; },
    f => { delete f.env.can_admins_bypass; },
    f => { f.env.deployment_branch_policy = null; },
    f => { delete f.env.deployment_branch_policy.custom_branch_policies; },
    f => { f.env.deployment_branch_policy.custom_branch_policies = false; },
    f => { f.env.deployment_branch_policy.custom_branch_policies = 'true'; },
    f => { f.policies = null; },
    f => { f.policies = {}; },
    f => { delete f.policies.total_count; },
    f => { f.policies.total_count = '1'; },
    f => { f.policies.total_count = 2; },
    f => { f.policies.branch_policies = []; },
    f => { f.policies.branch_policies = { 0: { name: 'main' }, length: 1 }; },
    f => { f.policies.branch_policies = [null]; },
    f => { f.policies.branch_policies.push({ name: 'release/*' }); },
    f => { f.policies.total_count = 2; f.policies.branch_policies.push({ name: 'main', type: 'tag' }); },
    f => { delete f.policies.branch_policies[0].name; },
    f => { f.policies.branch_policies[0].name = 'Main'; },
    f => { f.policies.branch_policies[0].name = 'main*'; },
    f => { f.policies.branch_policies[0].name = '*'; },
    f => { f.policies.branch_policies[0].type = 'tag'; },
    f => { f.policies.branch_policies[0].type = null; },
    f => { f.policies.branch_policies[0].type = 'unknown'; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(validate(client(f), context));
  }
});

test('rejects tags named main and other run contexts before any API call', async () => {
  for (const override of [
    { ref: 'refs/tags/main' }, { ref: 'main' }, { ref: 'refs/heads/main-extra' },
    { ref: undefined }, { eventName: 'push' }, { eventName: undefined },
    { repo: { owner: 'other', repo: 'teacher-hub' } },
    { repo: { owner: 'hoangbao179', repo: 'other' } },
  ]) {
    await assert.rejects(validate({}, { ...context, ...override }), /WIF requires/);
  }
});

test('workflow guards main branch/manual event and validates protection before auth', () => {
  const workflow = readFileSync(`${__dirname}/../.github/workflows/pdf-worker.yml`, 'utf8');
  const conditions = [...workflow.matchAll(/^    if: (.+)$/gm)].map(m => m[1]);
  assert.equal(conditions.length, 2);
  for (const [index, condition] of conditions.entries()) {
  for (const [ref, event_name, repository, expected] of [
    ['refs/heads/main', 'workflow_dispatch', 'hoangbao179/teacher-hub', true],
    ['refs/tags/main', 'workflow_dispatch', 'hoangbao179/teacher-hub', false],
    ['refs/heads/main-extra', 'workflow_dispatch', 'hoangbao179/teacher-hub', false],
    ['refs/heads/main', 'push', 'hoangbao179/teacher-hub', false],
    ['refs/heads/main', 'workflow_dispatch', 'other/teacher-hub', false],
  ]) {
    // This condition uses only equality and boolean operators shared by JS/Actions.
    assert.equal(runInNewContext(condition, { github: { ref, event_name, repository },
      inputs: { activation_request: index === 0 ? '' : '123-1' } }), expected);
    assert.equal(runInNewContext(condition, { github: { ref, event_name, repository },
      inputs: { activation_request: index === 0 ? '123-1' : '' } }), false);
  }
  }
  assert.match(workflow, /environment: pdf-worker/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /id-token: write/);
  const validation = workflow.indexOf("await require('./scripts/validate-pdf-environment.cjs')(github, context)");
  assert.ok(validation > 0 && validation < workflow.indexOf('uses: google-github-actions/auth@v3'));
});

test('workflow authenticates only the verifier and has no deployment path', () => {
  const workflow = readFileSync(`${__dirname}/../.github/workflows/pdf-worker.yml`, 'utf8');
  const trigger = workflow.split('\npermissions:')[0].split('\non:')[1];
  assert.match(trigger, /^\s+workflow_dispatch:\s+inputs:/);
  assert.doesNotMatch(trigger, /^  (?!workflow_dispatch:)[\w-]+:/m);
  assert.deepEqual([...trigger.matchAll(/^      ([\w-]+):$/gm)].map(m => m[1]), ['activation_request', 'source_sha']);
  assert.match(workflow, /service_account: \$\{\{ vars.GCP_VERIFIER_SA \}\}/);
  assert.match(workflow, /test "\$GCP_VERIFIER_SA" = teacher-pdf-verifier@teacher-hub-pdf\.iam\.gserviceaccount\.com/);
  assert.doesNotMatch(workflow, /GCP_DEPLOYER_SA|teacher-pdf-deployer|credentials_json|docker (build|push)|run deploy|run: bash scripts\/deploy-pdf-worker\.sh/);
  assert.deepEqual([...workflow.matchAll(/^  ([\w-]+):$/gm)].map(m => m[1]), ['workflow_dispatch', 'verify-wif', 'v2-readiness']);
  for (const job of workflow.split(/^  (?:verify-wif|v2-readiness):$/m).slice(1)) {
    assert.match(job, /environment: pdf-worker/);
    assert.match(job, /service_account: \$\{\{ vars.GCP_VERIFIER_SA \}\}/);
    const validation = job.indexOf("await require('./scripts/validate-pdf-environment.cjs')(github, context)");
    assert.ok(validation > 0 && validation < job.indexOf('uses: google-github-actions/auth@v3'));
  }
  assert.deepEqual(workflow.match(/^          gcloud .+$/gm).map(s => s.trim()), [
    'gcloud auth print-access-token >/dev/null',
    'gcloud artifacts repositories describe teacher-pdf \\',
  ]);
});
