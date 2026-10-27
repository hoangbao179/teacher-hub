// github-script adapter: dispatch through the existing WIF-approved workflow.
const fs = require('node:fs');
module.exports = async function dispatch(github, context, core, pause = ms => new Promise(r => setTimeout(r, ms))) {
  if (context.ref !== 'refs/heads/main' || context.repo.owner !== 'hoangbao179' || context.repo.repo !== 'teacher-hub') {
    throw Error('PDF_V2_MAIN_ONLY');
  }
  const request = `${context.runId}-${process.env.GITHUB_RUN_ATTEMPT}`;
  const sha = process.env.PDF_SOURCE_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !/^\d+-\d+$/.test(request)) throw Error('PDF_V2_INVALID_REQUEST');
  const base = {...context.repo, workflow_id: 'pdf-worker.yml'};
  await github.rest.actions.createWorkflowDispatch({...base, ref:'main',
    inputs:{activation_request:request, source_sha:sha}});
  for (let attempt=0; attempt<100; attempt++) {
    await pause(10000);
    const {data} = await github.rest.actions.listWorkflowRuns({...base, event:'workflow_dispatch', branch:'main', per_page:100});
    const run = data.workflow_runs.find(r=>r.display_title===`PDF v2 readiness ${request}` && r.head_sha===sha);
    if (!run || run.status!=='completed') continue;
    core.info(`Cloud readiness: ${run.html_url}`);
    if (run.conclusion!=='success') throw Error('PDF_V2_CLOUD_READINESS_FAILED: inspect linked run for WIF/IAM/readiness blocker');
    const artifacts = await github.rest.actions.listWorkflowRunArtifacts({...context.repo,run_id:run.id});
    const artifact = artifacts.data.artifacts.find(a=>a.name===`pdf-v2-readiness-${request}` && !a.expired);
    if (!artifact) throw Error('PDF_V2_EVIDENCE_MISSING');
    const download = await github.rest.actions.downloadArtifact({...context.repo,artifact_id:artifact.id,archive_format:'zip'});
    fs.writeFileSync(process.env.RUNNER_TEMP+'/pdf-v2-readiness.zip',Buffer.from(download.data));
    return;
  }
  throw Error('PDF_V2_CLOUD_READINESS_TIMEOUT: no activation attempted');
};
