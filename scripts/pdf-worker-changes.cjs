// github-script adapter. Compare against completed delivery, not just the last
// push: Actions may replace a pending run, or a preceding release may fail.
const { spawnSync } = require('node:child_process');
const SHA = /^[a-f0-9]{40}$/;
const paths = [
  'workers/pdf/', 'shared/', 'package.json', 'package-lock.json', '.npmrc', '.dockerignore',
  '.github/workflows/ci.yml', '.github/workflows/pdf-worker-release.yml',
  'scripts/pdf-worker-changes.cjs', 'scripts/pdf-worker-auto-release.mjs',
  'scripts/pdf-v2-readiness.mjs', 'scripts/pdf-cloud-stage.mjs',
  'scripts/pdf-cloud-stage-public-hmac.mjs',
  'scripts/validate-pdf-environment.cjs',
];

function changed(base, head, run = spawnSync) {
  if (!SHA.test(base ?? '') || !SHA.test(head ?? '')) return true;
  const result = run('git', ['diff', '--quiet', base, head, '--', ...paths]);
  // Missing history and any git error must never silently skip a build.
  return result.status !== 0;
}

async function detect(github, context, core, run = spawnSync) {
  if (context.repo.owner !== 'hoangbao179' || context.repo.repo !== 'teacher-hub' ||
      context.ref !== 'refs/heads/main' || !['push', 'workflow_dispatch'].includes(context.eventName)) {
    throw Error('PDF changes require trusted main delivery.');
  }
  if (context.payload.inputs?.force_worker_release === true ||
      context.payload.inputs?.force_worker_release === 'true') {
    core.setOutput('changed', 'true'); return;
  }
  let base;
  try {
    const { data: current } = await github.rest.actions.getWorkflowRun({ ...context.repo, run_id: context.runId });
    const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
      ...context.repo, workflow_id: 'ci.yml', branch: 'main', status: 'success', per_page: 100,
    });
    base = runs.filter(r => ['push', 'workflow_dispatch'].includes(r.event) &&
      r.run_number < current.run_number && r.head_repository?.full_name === 'hoangbao179/teacher-hub')
      .sort((a, b) => b.run_number - a.run_number)[0]?.head_sha;
  } catch {
    // API/history unavailable: extra build is safer than omitted Worker code.
    base = undefined;
  }
  core.setOutput('changed', String(changed(base, context.sha, run)));
}
module.exports = detect;
module.exports.changed = changed;
module.exports.paths = paths;
