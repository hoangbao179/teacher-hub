import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// No cloud CLI, credentials, push, deploy or remote Docker daemon is used.
const run = args => execFileSync('docker', args, { stdio: 'inherit', timeout: 240000 });
const capture = args => execFileSync('docker', args, { encoding: 'utf8', timeout: 10000 }).trim();
const context = capture(['context', 'show']);
const info = JSON.parse(capture(['context', 'inspect', context]))[0];
if (!/^(npipe:\/\/|unix:\/\/)/.test(info.Endpoints.docker.Host) || process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) {
  throw new Error('Use a local Docker context without endpoint overrides');
}
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const image = 'teacher-pdf-worker:local-processing-v1';
const docker = args => run(['--context', context, ...args]);
docker(['build', '--platform', 'linux/amd64', '-t', image, root]);
docker(['run', '--rm', '--platform', 'linux/amd64', '--network', 'none', '--cpus=1', '--memory=2g', '--memory-swap=2g',
  '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=128',
  '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=32m,mode=1777',
  '--mount', `type=bind,source=${resolve(root, 'test')},target=/app/test,readonly`,
  image, 'node', 'test/linux-run.mjs']);
console.log(capture(['--context', context, 'image', 'inspect', image, '--format', '{{.Id}} {{.Size}}']));
