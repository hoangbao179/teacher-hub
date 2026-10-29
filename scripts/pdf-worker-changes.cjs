// Small github-script adapter; GitHub job/step metadata is the stage evidence.
// CI_SUCCESS alone is not WORKER_STAGE_SUCCESS, nor PRODUCTION_PROMOTED.
const { spawnSync } = require('node:child_process');
const SHA = /^[a-f0-9]{40}$/;
const paths = [
  'workers/pdf/', 'shared/', 'package.json', 'package-lock.json', '.npmrc', '.dockerignore',
  // This file controls build commands, runtime version and staged resources.
  '.github/workflows/pdf-worker-release.yml',
];
const stageJobName = 'Release Cloud Run PDF Worker after VPS deployment / release';
const stageSteps = [
  'Resolve manifest digest', 'Check staged revision and live traffic',
  'Authenticated canary smoke', 'Recheck candidate and unchanged production traffic after smoke',
];
const stageCompletionSteps = [
  'Publish staged candidate for operator verification',
  'Auto-promote guarded canary when enabled and queue drained',
];

function stageSucceeded(job, sha) {
  return job.name === stageJobName && job.head_sha === sha &&
    job.status === 'completed' && job.conclusion === 'success' &&
    stageSteps.every(name => job.steps?.some(s => s.name === name &&
      s.status === 'completed' && s.conclusion === 'success')) &&
    stageCompletionSteps.some(name => job.steps?.some(s => s.name === name &&
      s.status === 'completed' && s.conclusion === 'success'));
}

async function stageBaseline(github, context) {
  const args = { ...context.repo };
  const { data: current } = await github.rest.actions.getWorkflowRun({ ...args, run_id: context.runId });
  if (!Number.isInteger(current.run_number) || current.run_number < 1 ||
      !Number.isInteger(current.workflow_id) || current.workflow_id < 1 || current.head_sha !== context.sha ||
      current.path?.split('@')[0] !== '.github/workflows/ci.yml') throw Error('Unverified CI history');
  const stageFor = async r => {
    const jobs = await github.paginate(github.rest.actions.listJobsForWorkflowRun,
      { ...args, run_id: r.id, filter: 'all', per_page: 100 });
    return jobs.some(j => stageSucceeded(j, r.head_sha));
  };
  // A successful earlier attempt of this exact source is also valid evidence.
  if (current.run_attempt > 1 && await stageFor(current)) return current;
  // Lazy pagination stops at the first verified stage, rather than downloading
  // all history or any logs/artifacts. Skipped/failed/cancelled jobs do not count.
  for await (const { data } of github.paginate.iterator(github.rest.actions.listWorkflowRuns, {
    ...args, workflow_id: 'ci.yml', branch: 'main', status: 'completed', per_page: 100,
  })) {
    const runs = data.filter(r => ['push', 'workflow_dispatch'].includes(r.event) &&
      r.run_number < current.run_number && r.head_branch === 'main' &&
      r.workflow_id === current.workflow_id && SHA.test(r.head_sha ?? '') &&
      r.head_repository?.full_name === 'hoangbao179/teacher-hub')
      .sort((a, b) => b.run_number - a.run_number);
    for (const r of runs) if (await stageFor(r)) return r;
  }
}

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
  if (context.eventName === 'workflow_dispatch') {
    const force = context.payload.inputs?.force_worker_release;
    const requested = force === true || force === 'true';
    core.setOutput('changed', String(requested));
    core.info?.(requested ? 'Worker build requested explicitly (force).' : 'Manual CI only; no Worker release requested.');
    return;
  }
  let base;
  try {
    const stage = await stageBaseline(github, context);
    base = stage?.head_sha;
    if (stage) core.info?.(`WORKER_STAGE_SUCCESS baseline: run ${stage.id}, source ${base}. Production promotion is not inferred.`);
    else core.info?.('No verified Worker stage in available history; build conservatively.');
  } catch {
    // API/history unavailable: extra build is safer than omitted Worker code.
    base = undefined;
    core.info?.('Worker stage history unavailable; build conservatively.');
  }
  const needsBuild = changed(base, context.sha, run);
  core.setOutput('changed', String(needsBuild));
  core.info?.(needsBuild ? 'Build Worker: inputs changed or comparison unavailable.' : 'Skip Worker build/push: inputs match verified stage.');
}
module.exports = detect;
module.exports.changed = changed;
module.exports.paths = paths;
module.exports.stageJobName = stageJobName;
module.exports.stageSteps = stageSteps;
module.exports.stageCompletionSteps = stageCompletionSteps;
