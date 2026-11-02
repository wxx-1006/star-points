/* 孩子端：等级称号 + 愿望清单 + 目标进度 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIndex, mkAd, rec } from './lib.mjs';

const PHONE = '13800000000';

async function setup(role) {
  const w = await loadIndex();
  w.currentUser = PHONE;
  w.sessionRole = role;
  w.localStorage.setItem('sp_gh_token', 'tok');
  w.ad = mkAd();
  return w;
}

test('等级：累计积分到档位对应称号', async () => {
  const w = await setup('kid');
  assert.equal(w.kidLevel(0).name, '新星');
  assert.equal(w.kidLevel(50).name, '闪耀星');
  assert.equal(w.kidLevel(200).name, '璀璨星');
  assert.equal(w.kidLevel(500).name, '璀璨星', '500+ 也归入璀璨星（已无传奇星档）');
});

test('累计获得：只统计正分流水（等级只升不降）', async () => {
  const w = await setup('kid');
  w.ad.records.push(rec(w, { score: 10 }));
  w.ad.records.push(rec(w, { score: 5 }));
  w.ad.records.push(rec(w, { score: -8 }));
  assert.equal(w.totalEarned(w.ad), 15);
});

test('孩子端首页：显示等级与愿望进度条', async () => {
  const w = await setup('kid');
  w.ad.records.push(rec(w, { score: 120 }));
  w.ad.totalPoints = 80;
  w.ad.wish = { name: '乐高积木', cost: 100 };
  w.renderKidGoal();
  const html = w.document.getElementById('kidGoal').innerHTML;
  assert.ok(html.includes('闪耀星'), '应显示等级称号');
  assert.ok(html.includes('乐高积木'), '应显示愿望名称');
  assert.ok(html.includes('还差 <b>20</b> 星'), '应显示还差 20 星');
});

test('孩子端首页：隐藏记录分数/兑换入口', async () => {
  const w = await setup('kid');
  w.renderKidGoal();
  assert.equal(w.document.getElementById('ctaSec').style.display, 'none');
});

test('家长端：设置愿望保存到账本并同步', async () => {
  const w = await setup('parent');
  w.document.getElementById('wishName').value = '乐高积木';
  w.document.getElementById('wishCost').value = '100';
  w.saveWish();
  assert.equal(w.ad.wish.name, '乐高积木');
  assert.equal(w.ad.wish.cost, 100);
});

test('孩子端：不能设置愿望（仅家长端）', async () => {
  const w = await setup('kid');
  w.document.getElementById('wishName').value = '玩具';
  w.document.getElementById('wishCost').value = '50';
  w.saveWish();
  assert.equal(w.ad.wish, undefined, '孩子端不应能设置愿望');
});
