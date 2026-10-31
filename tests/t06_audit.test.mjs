/* 数据体检 / 一键修复 / 导出备份覆盖范围 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIndex, mkAd, rec, seedCkTasks } from './lib.mjs';

const PHONE = '13800000000';

async function setup() {
  const w = await loadIndex();
  w.currentUser = PHONE;
  w.sessionRole = 'parent';
  w.localStorage.setItem('sp_gh_token', 'tok');
  return w;
}

function setBucket(w, acc) {
  w.localStorage.setItem(w.userKey(PHONE), JSON.stringify(acc));
}

test('体检：总分与明细一致时判定正常', async () => {
  const w = await setup();
  const acc = mkAd();
  acc.records.push(rec(w, { id: 'r1', score: 10 }));
  acc.totalPoints = 10;
  setBucket(w, acc);
  const item = w.dataAudit().find((i) => i.name === '总分与明细一致');
  assert.equal(item.ok, true, item.detail);
});

test('体检：总分漂移时判定异常并给出两个数', async () => {
  const w = await setup();
  const acc = mkAd();
  acc.records.push(rec(w, { id: 'r1', score: 10 }));
  acc.totalPoints = 999;
  setBucket(w, acc);
  const item = w.dataAudit().find((i) => i.name === '总分与明细一致');
  assert.equal(item.ok, false);
  assert.ok(item.detail.includes('999') && item.detail.includes('10'), item.detail);
});

test('体检：检出已删除记录残留（幽灵记录）', async () => {
  const w = await setup();
  const acc = mkAd();
  acc.records.push(rec(w, { id: 'r1', score: 10 }));
  acc.records.push(rec(w, { id: 'gone', score: -5 }));
  acc.del = { 'r:gone': Date.now() };
  acc.totalPoints = 10;
  setBucket(w, acc);
  const item = w.dataAudit().find((i) => i.name === '无已删除残留记录');
  assert.equal(item.ok, false, '应检出残留');
});

test('体检：检出必打卡已扣分但账本缺流水', async () => {
  const w = await setup();
  const acc = mkAd();
  acc.totalPoints = 0;
  setBucket(w, acc);
  seedCkTasks(w, PHONE, [{ id: '6', name: '必打卡任务', subj: 'other', must: 1, pt: 5, recur: { type: 'daily' } }]);
  const b = w.ckBucket();
  const ds = w.ckAddDays(w.today(), -2);
  b[ds] = b[ds] || {}; b[ds]['6'] = { c: 0, d: 0, r: 0, m: 1, t: Date.now() };
  w.ckSaveBucket(b);
  const item = w.dataAudit().find((i) => i.name === '必打卡扣分记录齐全');
  assert.equal(item.ok, false, '应检出缺失流水');
});

test('一键修复：重算总分并清理已删除残留记录', async () => {
  const w = await setup();
  const acc = mkAd();
  acc.records.push(rec(w, { id: 'r1', score: 10 }));
  acc.records.push(rec(w, { id: 'gone', score: -5 }));
  acc.del = { 'r:gone': Date.now() };
  acc.totalPoints = 999;
  setBucket(w, acc);
  w.dataFixRun();
  const after = JSON.parse(w.localStorage.getItem(w.userKey(PHONE)));
  assert.equal(after.totalPoints, 10, '总分应被重算为明细加总');
  assert.equal(after.records.length, 1, '已删除残留记录应被清理');
});

test('同步通道状态：列出全部通道并标出失败项', async () => {
  const w = await setup();
  w.ckSyncErr = '同步失败（HTTP 401）';
  w.renderChannelStates();
  const html = w.document.getElementById('chanList').innerHTML;
  assert.ok(html.includes('账本') && html.includes('打卡') && html.includes('宠物') && html.includes('专注'));
  assert.ok(html.includes('🔴'), '失败通道应标红');
  assert.ok(html.includes('401'), '应显示失败原因');
});

test('导出备份：覆盖账本/打卡/宠物/专注四类数据', async () => {
  const w = await setup();
  const acc = mkAd();
  acc.records.push(rec(w, { id: 'r1', score: 10 }));
  acc.totalPoints = 10;
  setBucket(w, acc);
  w.localStorage.setItem('sp_ck__' + PHONE, JSON.stringify({ _cfg: { tasks: [] } }));
  w.localStorage.setItem('sp_pet__' + PHONE, JSON.stringify({ name: '团子', created: '2026-10-08' }));
  w.localStorage.setItem('sp_fx__' + PHONE + ':history', '[]');
  let payload = null;
  const origBlob = w.Blob;
  w.Blob = function(parts){ payload = JSON.parse(parts[0]); return { size: parts[0].length }; };
  const origCreate = w.document.createElement.bind(w.document);
  w.document.createElement = (tag) => {
    const el = origCreate(tag);
    if (tag === 'a'){ el.click = () => {}; }
    return el;
  };
  w.exportBackup();
  w.Blob = origBlob;
  w.document.createElement = origCreate;
  assert.ok(payload, '应生成导出内容');
  assert.ok(payload.bucket, '含账本');
  assert.ok(payload.checkin, '含打卡状态');
  assert.ok(payload.pet, '含宠物');
  assert.ok(payload.focus, '含专注成绩');
});
