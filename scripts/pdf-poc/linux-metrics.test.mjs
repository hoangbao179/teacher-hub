import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLocalEndpoint,isNodeProcess,parseCounters,treeRss} from './linux-metrics.mjs';

test('process RSS includes descendants, excludes unrelated processes, independent of order', () => {
  const processes = [{pid:9,ppid:4,rssBytes:30},{pid:99,ppid:1,rssBytes:999},{pid:4,ppid:2,rssBytes:20},{pid:2,ppid:0,rssBytes:10}];
  assert.deepEqual(treeRss(processes, 2), {bytes:60,count:3});
});
test('cgroup counters distinguish OOM kill from ordinary exit', () => {
  assert.deepEqual(parseCounters('low 0\nhigh 0\nmax 8\noom 2\noom_kill 1\n'), {low:0,high:0,max:8,oom:2,oom_kill:1});
  assert.equal(parseCounters('usage_usec 120\nuser_usec 100\nsystem_usec 20').usage_usec, 120);
});

test('Docker benchmark refuses remote engines', () => {
  for(const endpoint of ['ssh://production','tcp://host:2375','https://host',undefined]) assert.throws(()=>assertLocalEndpoint(endpoint),/local/);
  for(const endpoint of ['unix:///var/run/docker.sock','npipe:////./pipe/dockerDesktopLinuxEngine']) assert.doesNotThrow(()=>assertLocalEndpoint(endpoint));
});

test('Node RSS classification uses executable because Linux Node 24 is named MainThread',()=>{
  assert.equal(isNodeProcess({name:'MainThread',executable:'/usr/local/bin/node'}),true);
  assert.equal(isNodeProcess({name:'node',executable:'/opt/chrome-headless-shell'}),false);
  assert.equal(isNodeProcess({name:'node'}),false);
});
