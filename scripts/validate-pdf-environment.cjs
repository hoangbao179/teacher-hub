// Small github-script require() adapter; no build or application dependencies.
// API/schema errors deliberately propagate; never print response bodies or credentials.
/** Validate the run context and environment before the workflow's WIF auth step. */
module.exports = async function validateEnvironment(github, context) {
  if (context.repo.owner !== 'hoangbao179' || context.repo.repo !== 'teacher-hub' ||
      context.ref !== 'refs/heads/main' || context.eventName !== 'workflow_dispatch') {
    throw new Error('WIF requires workflow_dispatch on teacher-hub main.');
  }
  const args = { ...context.repo, environment_name: 'pdf-worker' };
  const { data: env } = await github.rest.repos.getEnvironment(args);
  const review = Array.isArray(env?.protection_rules)
    ? env.protection_rules.find(r => r?.type === 'required_reviewers') : undefined;
  if (!Array.isArray(review?.reviewers) || review.reviewers.length === 0 ||
      !review.reviewers.every(r => ['User', 'Team'].includes(r?.type) &&
        Number.isInteger(r?.reviewer?.id) && r.reviewer.id > 0) ||
      review.prevent_self_review !== true || env.can_admins_bypass !== false) {
    throw new Error('Configure required reviewers, prevent self-review and disable admin bypass before WIF.');
  }
  if (env.deployment_branch_policy?.custom_branch_policies !== true) {
    throw new Error('Require explicit main-only environment policy.');
  }
  const { data } = await github.rest.repos.listDeploymentBranchPolicies(args);
  const policies = data?.branch_policies;
  // GitHub's LIST schema does not guarantee type. Explicit non-branch is unsafe.
  // Exact run ref above and the provider ref/workflow conditions exclude tags.
  if (data?.total_count !== 1 || !Array.isArray(policies) || policies.length !== 1 ||
      policies[0]?.name !== 'main' ||
      ('type' in policies[0] && policies[0].type !== 'branch')) {
    throw new Error('Environment must allow only the main branch.');
  }
};
