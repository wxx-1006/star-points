/* 报告页：加分构成合并 / 区间过滤 / 明细弹窗 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIndex, mkAd, rec } from './lib.mjs';

const PHONE = '13800000000';

async function setupWithRecords() {
  const w = await loadIndex();
  w.currentUser = PHONE;
  w.sessionRole = 'parent';
  w.ad = mkAd();
  w.ad.records.push(rec(w, { id: 'a', score: 5, itemId: 'ck_reward', name: '读书（打卡）', category: '打卡' }));
  w.ad.records.push(rec(w, { id: 'b', score: 20, itemId: 'ck_bonus', name: '当日打卡全部完成', category: '打卡' }));
  w.ad.records.push(rec(w, { id: 'c', score: 10, itemId: 'ck_must_bonus', name: '当日必打卡全部完成', category: '打卡' }));
  w.ad.records.push(rec(w, { id: 'd', score: 2, itemId: 'ck_makeup', name: '读书（补卡）', category: '打卡' }));
  w.ad.records.push(rec(w, { id: 'e', score: 8, category: '学习', name: '作业全对' }));
  w.ad.records.push(rec(w, { id: 'f', score: 4, itemId: 'quiz_reward', name: '答题获取', category: '学习' }));
  return w;
}

test('报告：加分构成中补卡与打卡奖励合并为一项「打卡奖励」', async () => {
  const w = await setupWithRecords();
  w.setReportRange('month');
  const body = w.document.getElementById('reportBody').innerHTML;
  assert.ok(body.includes('打卡奖励'), '应存在「打卡奖励」项');
  assert.ok(body.includes('+37'), '金额应为 5+20+10+2=37');
  assert.ok(!/class="rp-cat">打卡</.test(body), '不应再单列「打卡」分类');
});

test('报告：答题奖励仍单独成项，普通分类照旧', async () => {
  const w = await setupWithRecords();
  w.setReportRange('month');
  const body = w.document.getElementById('reportBody').innerHTML;
  assert.ok(body.includes('答题奖励'));
  assert.ok(body.includes('学习'));
  assert.ok(body.includes('+8'));
});

test('报告：打卡奖励明细包含补卡记录', async () => {
  const w = await setupWithRecords();
  w.setReportRange('month');
  w.openRdCkR();
  const html = w.document.body.innerHTML;
  assert.ok(html.includes('补卡'), '明细里应能看到补卡记录');
});

test('报告：区间过滤——历史记录不计入本月', async () => {
  const w = await setupWithRecords();
  w.ad.records.push(rec(w, { id: 'old', date: '2025-12-01', score: 99, category: '学习', name: '去年加分' }));
  w.setReportRange('month');
  const body = w.document.getElementById('reportBody').innerHTML;
  assert.ok(!body.includes('+99'), '本月视图不应包含去年记录');
});

test('报告：本年区间包含全年记录', async () => {
  const w = await setupWithRecords();
  w.ad.records.push(rec(w, { id: 'old', date: '2026-01-15', score: 99, category: '学习', name: '年初加分' }));
  w.setReportRange('year');
  const body = w.document.getElementById('reportBody').innerHTML;
  assert.ok(body.includes('+99'), '本年视图应包含该记录');
});

test('报告：自定义区间只统计所选范围', async () => {
  const w = await setupWithRecords();
  const ds1 = w.today();
  const ds2 = w.ckAddDays(w.today(), -40);
  w.ad.records.push(rec(w, { id: 'old', date: ds2, score: 77, category: '学习', name: '区间外' }));
  w.reportCustom = { start: ds1, end: ds1 };
  w.renderReport(); /* custom 需选定日期后才生效，这里直接渲染 */
  const body = w.document.getElementById('reportBody').innerHTML;
  assert.ok(!body.includes('+77'), '区间外记录不应出现');
  assert.ok(body.includes('+8'), '区间内记录应出现');
});
