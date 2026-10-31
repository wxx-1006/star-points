/* 打卡：24点扣分规则 / 补记流水 / 补卡 / 奖励档位 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIndex, mkAd, seedCkTasks, sleep } from './lib.mjs';

const PHONE = '13800000000';
const TASKS = [{ id: '6', name: '必打卡任务', subj: 'other', must: 1, pt: 5, recur: { type: 'daily' } }];

async function setup(role = 'parent') {
  const w = await loadIndex();
  w.currentUser = PHONE;
  w.sessionRole = role;
  w.localStorage.setItem('sp_gh_token', 'tok');
  seedCkTasks(w, PHONE, TASKS);
  w.ad = mkAd();
  return w;
}

test('必打卡：当天 23:50 尚未过完时不扣分（24 点规则）', async () => {
  const w = await setup();
  const dsY = w.ckAddDays(w.today(), -1);
  w.ckMustSweep(new Date(dsY + 'T23:50:00')); /* 以"该日 23:50"的视角结算 */
  const st = (w.ckBucket()[dsY] || {})['6'] || {};
  assert.notEqual(st.m, 1, '当天未过完不应标记扣分');
});

test('必打卡：次日 0:30 补扫昨天并扣分（流水日期=任务所属日）', async () => {
  const w = await setup();
  const dsY = w.ckAddDays(w.today(), -1);
  w.ckMustSweep(new Date(w.today() + 'T00:30:00'));
  const st = (w.ckBucket()[dsY] || {})['6'] || {};
  assert.equal(st.m, 1, '应标记扣分');
  const pen = w.ad.records.filter((r) => r.id === 'ckm_' + dsY + '_6');
  assert.equal(pen.length, 1);
  assert.equal(pen[0].date, dsY);
  assert.equal(pen[0].score, -5);
});

test('必打卡：孩子端结算只写标记、不写账本流水（孩子端数据不落库）', async () => {
  const w = await setup('kid');
  w.ckMustSweep(new Date(w.today() + 'T00:30:00'));
  assert.equal(w.ad.records.length, 0, '孩子端不应产生账本流水');
});

test('必打卡：家长端为孩子端已标记的任务补记扣分流水（自愈）', async () => {
  const w = await setup('kid');
  const dsY = w.ckAddDays(w.today(), -1);
  w.ckMustSweep(new Date(w.today() + 'T00:30:00'));
  assert.equal(w.ad.records.length, 0);
  w.sessionRole = 'parent';
  w.ad = mkAd();
  w.ckMustSweep(new Date(w.today() + 'T01:00:00'));
  const pen = w.ad.records.filter((r) => r.id === 'ckm_' + dsY + '_6');
  assert.equal(pen.length, 1, '家长端应补记流水');
  const allPen = w.ad.records.filter((r) => r.itemId === 'ck_must');
  assert.equal(w.ad.totalPoints, -5 * allPen.length, '总分应与扣分流水条数一致');
});

test('必打卡：补记流水后重复结算幂等（不重复扣）', async () => {
  const w = await setup();
  w.ckMustSweep(new Date(w.today() + 'T00:30:00'));
  const n1 = w.ad.records.length, t1 = w.ad.totalPoints;
  w.ckMustSweep(new Date(w.today() + 'T02:00:00'));
  assert.equal(w.ad.records.length, n1);
  assert.equal(w.ad.totalPoints, t1);
});

test('必打卡：已删除（墓碑）的扣分不再自动补记（视为豁免）', async () => {
  const w = await setup();
  const dsY = w.ckAddDays(w.today(), -1);
  const b = w.ckBucket();
  b[dsY] = b[dsY] || {}; b[dsY]['6'] = { c: 0, d: 0, r: 0, m: 1, t: Date.now() };
  w.ckSaveBucket(b);
  w.ad = mkAd();
  w.ad.del = { ['r:ckm_' + dsY + '_6']: Date.now() };
  w.ckMustSweep(new Date(w.today() + 'T02:00:00'));
  assert.equal(w.ad.records.filter((r) => r.id === 'ckm_' + dsY + '_6').length, 0);
});

test('补卡：过期任务补卡加原值一半（向下取整）且任务标为已完成', async () => {
  const w = await setup();
  const dsX = '2026-10-18';
  w.ckDate = dsX;
  w.ckMakeup(dsX, '6');
  const st = (w.ckBucket()[dsX] || {})['6'] || {};
  assert.equal(st.d, 1);
  assert.equal(st.mk, 2); /* 5 分的一半向下取整 */
  const mk = w.ad.records.find((r) => r.id === 'ckmk_' + dsX + '_6');
  assert.ok(mk, '应有补卡流水');
  assert.equal(mk.score, 2);
  assert.equal(mk.date, dsX);
});

test('补卡：重复补卡被拦截（不重复加分）', async () => {
  const w = await setup();
  const dsX = '2026-10-18';
  w.ckDate = dsX;
  w.ckMakeup(dsX, '6');
  const n = w.ad.records.length;
  w.ckMakeup(dsX, '6');
  assert.equal(w.ad.records.length, n);
});

test('奖励档位：必打卡全部完成 +10；当日全部完成 +20', async () => {
  const w = await setup();
  const ds = '2026-10-21';
  const b = w.ckBucket();
  b[ds] = b[ds] || {}; b[ds]['6'] = { c: 1, d: 0, r: 0, dd: ds, t: Date.now() };
  w.ckSaveBucket(b);
  w.ckDate = ds;
  w.ckConfirm(ds, '6');
  const mb = w.ad.records.find((r) => r.id === 'ckmb_' + ds);
  assert.ok(mb && mb.score === 10, '必打卡档 +10');
  const bb = w.ad.records.find((r) => r.id === 'ckb_' + ds);
  assert.ok(bb && bb.score === 20, '全勤档 +20');
});

test('系统流水不可删除（打卡扣分/补卡/奖励）', async () => {
  const w = await setup();
  w.ad.records.push({ id: 'ckm_x', date: w.today(), score: -5, itemId: 'ck_must', name: '必打卡未完成' });
  w.ad.records.push({ id: 'ckmk_y', date: w.today(), score: 2, itemId: 'ck_makeup', name: '补卡' });
  w.deleteRecord('ckm_x');
  w.deleteRecord('ckmk_y');
  assert.equal(w.ad.records.length, 2, '打卡系统流水不应被删除');
});

test('激励：连续打卡天数与本周完成天数统计正确', async () => {
  const w = await setup();
  const b = w.ckBucket();
  for (const off of [0, 1, 2]) {
    const ds = w.ckAddDays(w.today(), -off);
    b[ds] = b[ds] || {};
    b[ds]['6'] = { c: 1, d: 1, r: 1, t: Date.now() };
  }
  w.ckSaveBucket(b);
  assert.equal(w.ckStreak(), 3, '连续 3 天');
  assert.ok(w.ckWeekDone() >= 1, '本周至少完成 1 天');
});

test('激励：徽章在打卡页渲染（含连续天数与鼓励语）', async () => {
  const w = await setup();
  const b = w.ckBucket();
  for (const off of [0, 1, 2]) {
    const ds = w.ckAddDays(w.today(), -off);
    b[ds] = b[ds] || {};
    b[ds]['6'] = { c: 1, d: 1, r: 1, t: Date.now() };
  }
  w.ckSaveBucket(b);
  w.ckShow();
  const html = w.document.getElementById('ckList').innerHTML;
  assert.ok(html.includes('ck-motivate'), '应渲染激励徽章');
  assert.ok(html.includes('已连续打卡'), '应显示连续天数');
  assert.ok(html.includes('本周完成'), '应显示本周完成天数');
});
