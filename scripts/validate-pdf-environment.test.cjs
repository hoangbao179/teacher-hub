const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('./validate-pdf-environment.cjs');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const context = { repo: { owner: 'hoangbao179', repo: 'teacher-hub' }, ref: 'refs/heads/main', eventName: 'workflow_dispatch' };
function fixture() {
  return {
    env: { protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 1 } }], prevent_self_review: true }], can_admins_bypass: false, deployment_branch_policy: { custom_branch_policies: true } },
    // Official GitHub LIST example shape, reduced to the sole allowed policy.
    policies: { total_count: 1, branch_policies: [{ id: 361472, node_id: 'example', name: 'main' }] },
  };
}
function client(f, failure, status = 403) {
  return { rest: { repos: {
    getEnvironment: async args => { assert.deepEqual(args, { ...context.repo, environment_name: 'pdf-worker' }); if (failure === 'env') throw Object.assign(new Error('API failure'), { status }); return { data: f.env }; },
    listDeploymentBranchPolicies: async args => { assert.deepEqual(args, { ...context.repo, environment_name: 'pdf-worker' }); if (failure === 'policies') throw Object.assign(new Error('API failure'), { status }); return { data: f.policies }; },
  } } };
}
test('accepts official response without type and explicit branch type', async () => {
  const f = fixture();
  await validate(client(f), context);
  f.policies.branch_policies[0].type = 'branch';
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
    f => { f.env.protection_rules = []; },
    f => { f.env.protection_rules[0].reviewers = []; },
    f => { delete f.env.protection_rules[0].reviewers; },
    f => { f.env.protection_rules[0].reviewers = { length: 1 }; },
    f => { f.env.protection_rules[0].reviewers = [null]; },
    f => { f.env.protection_rules[0].reviewers[0].reviewer = {}; },
    f => { f.env.protection_rules[0].prevent_self_review = false; },
    f => { f.env.protection_rules[0].prevent_self_review = 'true'; },
    f => { delete f.env.protection_rules[0].prevent_self_review; },
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
  const condition = workflow.match(/^    if: (.+)$/m)[1];
  for (const [ref, event_name, repository, expected] of [
    ['refs/heads/main', 'workflow_dispatch', 'hoangbao179/teacher-hub', true],
    ['refs/tags/main', 'workflow_dispatch', 'hoangbao179/teacher-hub', false],
    ['refs/heads/main-extra', 'workflow_dispatch', 'hoangbao179/teacher-hub', false],
    ['refs/heads/main', 'push', 'hoangbao179/teacher-hub', false],
    ['refs/heads/main', 'workflow_dispatch', 'other/teacher-hub', false],
  ]) {
    // This condition uses only equality and boolean operators shared by JS/Actions.
    assert.equal(runInNewContext(condition, { github: { ref, event_name, repository } }), expected);
  }
  assert.match(workflow, /environment: pdf-worker/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /id-token: write/);
  const validation = workflow.indexOf("await require('./scripts/validate-pdf-environment.cjs')(github, context)");
  assert.ok(validation > 0 && validation < workflow.indexOf('uses: google-github-actions/auth@v3'));
});
