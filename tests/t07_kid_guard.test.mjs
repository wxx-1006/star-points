/* 孩子端边界：写操作必须被函数层守卫拦截（不只靠 UI 隐藏） */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIndex, mkAd, rec } from './lib.mjs';

const PHONE = '13800000000';

async function kid() {
  const w = await loadIndex();
  w.currentUser = PHONE;
  w.sessionRole = 'kid';
  w.localStorage.setItem('sp_gh_token', 'tok');
  w.ad = mkAd();
  return w;
}

test('孩子端：不能删除记录', async () => {
  const w = await kid();
  w.ad.records.push(rec(w, { id: 'r1', score: 5 }));
  w.deleteRecord('r1');
  assert.equal(w.ad.records.length, 1, '记录不应被删除');
});

test('孩子端：不能直接兑换（扣分）', async () => {
  const w = await kid();
  w.ad.totalPoints = 100;
  w.ad.shopItems = [{ id: 's1', name: '玩具', cost: 50 }];
  w.document.getElementById('exSelect').innerHTML = '<option value="s1">玩具</option>';
  w.confirmExchange();
  assert.equal(w.ad.totalPoints, 100, '总分不应被扣');
  assert.equal(w.ad.exchanges.length, 0, '不应生成兑换记录');
});

test('孩子端：不能清除所有数据', async () => {
  const w = await kid();
  w.ad.records.push(rec(w, { id: 'r1', score: 5 }));
  w.ccd();
  assert.equal(w.ad.records.length, 1, '数据不应被清除');
});

test('孩子端：不能直接记分', async () => {
  const w = await kid();
  w.ad.records.push(rec(w, { id: 'r1', score: 1 }));
  const before = w.ad.totalPoints;
  try { w.ss(); } catch (e) {}
  assert.equal(w.ad.totalPoints, before, '总分不应变化');
});

test('孩子端：写账本被 sd 守卫拦截（不落盘）', async () => {
  const w = await kid();
  w.ad.records.push(rec(w, { id: 'r1', score: 5 }));
  w.sd(w.ad);
  assert.equal(w.localStorage.getItem(w.userKey(PHONE)), null, '孩子端不应写入本机账本');
});

test('孩子端：设置页不渲染（含云端 token 不可见）', async () => {
  const w = await kid();
  let called = 0;
  w.renderSyncSettings = () => { called++; }; /* renderSettings 内部会调它填充 token/同步状态 */
  w.renderSettings();
  assert.equal(called, 0, '孩子端 renderSettings 应早退，不填充设置数据');
});
