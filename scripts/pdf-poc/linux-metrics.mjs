import fs from 'node:fs';
import path from 'node:path';

export function assertLocalEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || (!endpoint.startsWith('npipe:') && !endpoint.startsWith('unix:')))
    throw Error('Only local Docker endpoints allowed');
}

export function parseCounters(text) {
  return Object.fromEntries(text.trim().split('\n').filter(Boolean).map(line => {
    const [key, value] = line.trim().split(/\s+/); return [key, Number(value)];
  }));
}

export function treeRss(processes, rootPid) {
  const ids = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of processes) if (ids.has(p.ppid) && !ids.has(p.pid)) { ids.add(p.pid); changed = true; }
  }
  const members = processes.filter(p => ids.has(p.pid));
  return { bytes: members.reduce((sum, p) => sum + p.rssBytes, 0), count: members.length };
}

export function directoryBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw Error('Unexpected symlink in benchmark output');
    return sum + (entry.isDirectory() ? directoryBytes(file) : fs.statSync(file).size);
  }, 0);
}
