// API/schema errors deliberately propagate; never print response bodies or credentials.
module.exports = async function validateEnvironment(github, context) {
const args = { ...context.repo, environment_name: 'pdf-worker' };
const { data: env } = await github.rest.repos.getEnvironment(args);
const review = env.protection_rules.find(r => r.type === 'required_reviewers');
if (!review?.reviewers?.length || review.prevent_self_review !== true || env.can_admins_bypass !== false) {
  throw new Error('Configure required reviewers, prevent self-review and disable admin bypass before WIF.');
}
if (!env.deployment_branch_policy?.custom_branch_policies) throw new Error('Require explicit main-only environment policy.');
const { data } = await github.rest.repos.listDeploymentBranchPolicies(args);
if (data.total_count !== 1 || data.branch_policies[0].name !== 'main' || data.branch_policies[0].type !== 'branch') {
  throw new Error('Environment must allow only the main branch.');
}

};
