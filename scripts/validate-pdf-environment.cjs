// Small github-script require() adapter; no build or application dependencies.
// API/schema errors deliberately propagate; never print response bodies or credentials.
/** Validate the run context and environment before the workflow's WIF auth step. */
module.exports = async function validateEnvironment(github, context) {
  if (context.repo.owner !== 'hoangbao179' || context.repo.repo !== 'teacher-hub' ||
      context.ref !== 'refs/heads/main' || context.eventName !== 'workflow_dispatch') {
    throw new Error('WIF requires workflow_dispatch on teacher-hub main.');
  }
  await validateProtection(github, context.repo, 'pdf-worker');
};

async function validateProtection(github, repo, environment) {
  const args = { ...repo, environment_name: environment };
  const { data: env } = await github.rest.repos.getEnvironment(args);
  // Reviewers are optional for the verifier; security metadata is not inferred.
  if (env?.name !== environment || !Array.isArray(env.protection_rules) ||
      !env.protection_rules.every(r => r && typeof r.type === 'string') ||
      env.can_admins_bypass !== false) {
    throw new Error('Require pdf-worker metadata and explicit disabled admin bypass.');
  }
  if (env.deployment_branch_policy?.custom_branch_policies !== true ||
      env.deployment_branch_policy?.protected_branches !== false) {
    throw new Error('Require explicit main-only environment policy.');
  }
  const { data } = await github.rest.repos.listDeploymentBranchPolicies(args);
  const policies = data?.branch_policies;
  // REST examples omit type. Omission cannot prove branch versus tag: fail closed.
  // Live responses include type; a matching name alone is insufficient.
  if (data?.total_count !== 1 || !Array.isArray(policies) || policies.length !== 1 ||
      policies[0]?.name !== 'main' ||
      policies[0]?.type !== 'branch') {
    throw new Error('Environment must allow only the main branch.');
  }
}

module.exports.release = async function validateRelease(github, context) {
  if (context.repo.owner !== 'hoangbao179' || context.repo.repo !== 'teacher-hub' ||
      context.ref !== 'refs/heads/main' || !['push', 'workflow_dispatch'].includes(context.eventName)) {
    throw new Error('Release WIF requires teacher-hub main delivery.');
  }
  await validateProtection(github, context.repo, 'pdf-worker-deploy');
};
