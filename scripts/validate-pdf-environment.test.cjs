const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('./validate-pdf-environment.cjs');
const context = { repo: { owner: 'hoangbao179', repo: 'teacher-hub' } };
function fixture() {
  return {
    env: { protection_rules: [{ type: 'required_reviewers', reviewers: [{ type: 'User', reviewer: { id: 1 } }], prevent_self_review: true }], can_admins_bypass: false, deployment_branch_policy: { custom_branch_policies: true } },
    policies: { total_count: 1, branch_policies: [{ name: 'main', type: 'branch' }] },
  };
}
function client(f, failure) {
  return { rest: { repos: {
    getEnvironment: async args => { assert.equal(args.environment_name, 'pdf-worker'); if (failure === 'env') throw new Error('403'); return { data: f.env }; },
    listDeploymentBranchPolicies: async () => { if (failure === 'policies') throw new Error('503'); return { data: f.policies }; },
  } } };
}
test('accepts protected environment', async () => validate(client(fixture()), context));
test('API denial and errors propagate before authentication', async () => {
  for (const failure of ['env', 'policies']) await assert.rejects(validate(client(fixture(), failure), context));
});
test('rejects unsafe, incomplete and malformed protection responses', async () => {
  for (const mutate of [
    f => { f.env = null; },
    f => { f.env.protection_rules = []; },
    f => { f.env.protection_rules[0].reviewers = []; },
    f => { f.env.protection_rules[0].prevent_self_review = false; },
    f => { f.env.protection_rules[0].prevent_self_review = 'true'; },
    f => { f.env.can_admins_bypass = true; },
    f => { delete f.env.can_admins_bypass; },
    f => { f.env.deployment_branch_policy = null; },
    f => { f.policies = {}; },
    f => { f.policies.total_count = 2; },
    f => { f.policies.branch_policies = []; },
    f => { f.policies.branch_policies[0].name = '*'; },
    f => { f.policies.branch_policies[0].type = 'tag'; },
    f => { delete f.policies.branch_policies[0].type; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(validate(client(f), context));
  }
});
