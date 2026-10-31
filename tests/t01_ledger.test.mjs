/* 账本：总分口径 / 墓碑 / 合并 / 拉取不覆盖 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIndex, mkAd, rec, sleep } from './lib.mjs';

test('rdSumScore：总分恒等于流水加总，且跳过已删除（墓碑）记录', async () => {
  const w = await loadIndex();
  const d = mkAd();
  d.records.push(rec(w, { id: 'r1', score: 10 }));
  d.records.push(rec(w, { id: 'r2', score: -5 }));
  d.exchanges.push({ id: 'e1', cost: 3, date: w.today(), name: '兑换' });
  d.del = { 'r:r2': Date.now() }; /* r2 已删除 */
  assert.equal(w.rdSumScore(d), 7); /* 10 - 3，-5 的 r2 属墓碑不计 */
  d.del = {};
  assert.equal(w.rdSumScore(d), 2); /* 10 - 5 - 3 */
});

test('sd：保存时物理剔除墓碑记录并按流水重算总分', async () => {
  const w = await loadIndex();
  w.currentUser = '13800000000';
  w.sessionRole = 'parent';
  const d = mkAd();
  d.records.push(rec(w, { id: 'r1', score: 10 }));
  d.records.push(rec(w, { id: 'r2', score: -5 }));
  d.del = { 'r:r2': Date.now() };
  d.totalPoints = 100;
  w.sd(d);
  assert.equal(d.records.length, 1);
  assert.equal(d.totalPoints, 10);
  const stored = JSON.parse(w.localStorage.getItem(w.userKey('13800000000')));
  assert.equal(stored.records.length, 1);
  assert.equal(stored.totalPoints, 10);
});

test('render：打开即自愈总分漂移', async () => {
  const w = await loadIndex();
  w.currentUser = '13800000000';
  w.sessionRole = 'parent';
  w.ad = mkAd();
  w.ad.records.push(rec(w, { id: 'r1', score: 12 }));
  w.ad.totalPoints = 999;
  w.render();
  assert.equal(w.ad.totalPoints, 12);
});

test('mergeAccountData：记录级并集 + 墓碑保护 + 总分重算', async () => {
  const w = await loadIndex();
  const local = { records: [rec(w, { id: 'a', score: 7 })], exchanges: [], totalPoints: 7, del: {} };
  const remote = { records: [rec(w, { id: 'b', score: 3 })], exchanges: [], totalPoints: 3, del: {} };
  const m = w.mergeAccountData(local, remote).data;
  const ids = m.records.map((r) => r.id);
  assert.ok(ids.includes('a') && ids.includes('b'), '两端记录都在');
  assert.equal(m.totalPoints, 10);
});

test('mergeAccountData：云端墓碑命中的记录不会复活', async () => {
  const w = await loadIndex();
  const local = { records: [rec(w, { id: 'gone', score: 5 })], exchanges: [], totalPoints: 5, del: {} };
  const remote = { records: [], exchanges: [], totalPoints: 0, del: { 'r:gone': Date.now() } };
  const m = w.mergeAccountData(local, remote).data;
  assert.equal(m.records.length, 0);
  assert.equal(m.totalPoints, 0);
});

test('syncPull：一律合并，本地未推的记录不会被云端覆盖', async () => {
  const w = await loadIndex();
  w.currentUser = '13800000000';
  w.sessionRole = 'parent';
  w.localStorage.setItem('sp_gh_token', 'tok'); /* 未配令牌时 syncPull 直接跳过，不拉取 */
  const cloud = { '13800000000': { records: [rec(w, { id: 'cloud', score: 3 })], exchanges: [], totalPoints: 3, del: {} } };
  w.localStorage.setItem(w.userKey('13800000000'), JSON.stringify({
    records: [rec(w, { id: 'local', score: 7 })], exchanges: [], totalPoints: 7, del: {}
  }));
  w.fetch = () => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ sha: 's1', content: Buffer.from(JSON.stringify(cloud)).toString('base64') })
  });
  await w.syncPull('13800000000');
  await sleep(100);
  const acc = JSON.parse(w.localStorage.getItem(w.userKey('13800000000')));
  const ids = acc.records.map((r) => r.id);
  assert.ok(ids.includes('local') && ids.includes('cloud'), '本地与云端记录都在：' + ids.join(','));
  assert.equal(acc.totalPoints, 10);
});

test('ghPutBody：新建文件不带空 sha（否则 GitHub 返回 422），更新才带', async () => {
  const w = await loadIndex();
  assert.equal(JSON.parse(w.ghPutBody('m', 'Yw==', '')).sha, undefined);
  assert.equal(JSON.parse(w.ghPutBody('m', 'Yw==', null)).sha, undefined);
  assert.equal(JSON.parse(w.ghPutBody('m', 'Yw==', 'abc')).sha, 'abc');
});
