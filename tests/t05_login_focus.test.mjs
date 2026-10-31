/* 新设备登录找回账本 + 专注页四项优化 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIndex, loadFocus, sleep } from './lib.mjs';

const PHONE = '13800000000';

test('登录页：提供「已有账本？配置同步令牌找回」入口', async () => {
  const w = await loadIndex();
  const html = w.document.documentElement.innerHTML;
  assert.ok(html.includes('已有账本？配置同步令牌找回'), '登录页应有令牌找回入口');
  assert.equal(typeof w.ckTokOpen, 'function');
});

test('登录页：无令牌且本机无账本时，提示引导配置令牌（不再说"新用户创建账本"）', async () => {
  const w = await loadIndex();
  w.localStorage.removeItem('sp_gh_token');
  w.document.getElementById('loginPhone').value = PHONE;
  w.checkLoginPhone();
  const hint = w.document.getElementById('loginDetectHint').textContent;
  assert.ok(hint.includes('配置同步令牌'), '提示应引导配置令牌：' + hint);
  assert.ok(!hint.includes('创建账本'), '不应再误导为新用户：' + hint);
});

test('登录页：配好令牌后自动重新查找账本', async () => {
  const w = await loadIndex();
  w.localStorage.removeItem('sp_gh_token');
  w.document.getElementById('loginPhone').value = PHONE;
  w.ckTokOpen();
  assert.ok(w.document.getElementById('mCkTok').classList.contains('show'));
  w.document.getElementById('ckTokInput').value = 'github_pat_test';
  w.ckTokSave();
  assert.equal(w.localStorage.getItem('sp_gh_token'), 'github_pat_test');
  await sleep(300);
  const hint = w.document.getElementById('loginDetectHint').textContent;
  assert.ok(!hint.includes('创建账本'), '配好令牌后不应再提示新用户：' + hint);
});

test('专注页：timingResult 准确优先 + 与最佳对比', async () => {
  const w = await loadFocus();
  const T = w.timingResult;
  assert.equal(T(null, 5000, 0).isNew, true);
  assert.ok(T(null, 5000, 0).cmp.includes('首次'));
  assert.equal(T({ ms: 8000 }, 5000, 1).isNew, true);
  assert.ok(T({ ms: 8000 }, 5000, 1).cmp.includes('快了'));
  assert.equal(T({ ms: 3000 }, 5000, 0).isNew, false);
  assert.ok(T({ ms: 3000 }, 5000, 0).cmp.includes('慢'));
  assert.equal(T({ ms: 8000 }, 5000, 5).isNew, false, '错误过多不计最佳');
  assert.ok(T({ ms: 8000 }, 5000, 5).cmp.includes('过多'));
  assert.equal(T({ ms: 8000 }, 5000, 2).isNew, true, '错误恰好 2 仍有效');
});

test('专注页：今日推荐按三类每日轮换，点击可直达对应游戏', async () => {
  const w = await loadFocus();
  const rec = w.dailyRecList();
  assert.equal(rec.length, 3);
  assert.ok(['schulte', 'track', 'cancel'].includes(rec[0]));
  assert.ok(['memory', 'corsi'].includes(rec[1]));
  assert.ok(['stroop', 'switch'].includes(rec[2]));
  const box = w.document.getElementById('dailyRec');
  assert.equal(box.hidden, false);
  const chip = box.querySelector('.dr-chip');
  chip.click();
  assert.ok(w.document.getElementById('panel-' + chip.dataset.g).classList.contains('on'));
});

test('专注页：成绩分析汇总与趋势曲线', async () => {
  const w = await loadFocus({ url: 'https://star.test/?acct=test&role=parent' });
  const p2 = (n) => (n < 10 ? '0' : '') + n;
  const now = new Date();
  const ds = (off) => { const x = new Date(now.getTime() - off * 86400000); return x.getFullYear() + '-' + p2(x.getMonth() + 1) + '-' + p2(x.getDate()); };
  const hist = [];
  for (let i = 0; i < 12; i++) hist.push({ g: 'schulte', ds: ds(i), tm: '10:00', ts: now.getTime() - i * 100000, v: 8000 + i * 500, sub: '', best: 0, u: 'u' + i });
  for (let i = 0; i < 3; i++) hist.push({ g: 'corsi', ds: ds(i * 4), tm: '09:00', ts: now.getTime() - i * 200000, v: 5 + i, sub: '', best: 0, u: 'c' + i });
  w.localStorage.setItem('sp_fx__test:history', JSON.stringify(hist));
  w.renderHistory();
  const sum = w.summarizeHistory(hist);
  assert.equal(sum.schulte.count, 12);
  assert.equal(sum.schulte.best, 8000, '耗时类最佳取最小');
  assert.equal(sum.corsi.best, 7, '格数类最佳取最大');
  assert.equal(w.document.querySelectorAll('#recSummary .rs-card').length, 2);
  assert.ok(w.document.getElementById('recSummary').textContent.includes('练得最少'), '家长端应显示最弱项提示');
  assert.ok(w.sparklineSvg([8000, 7800, 7600], 'min').includes('polyline'));
  assert.equal(w.sparklineSvg([8000], 'min'), '', '不足 2 次不生成曲线');
});

test('专注页：休息提醒——弹窗期间不重复提醒，点确定后重新计 20 分钟', async () => {
  const w = await loadFocus();
  const T = w.restDue;
  assert.equal(T(1000, 999, false), false);
  assert.equal(T(1000, 1000, false), true);
  assert.equal(T(1000, 5000, true), false, '弹窗开着时不重复提醒');
  let called = 0;
  w.showResult('该休息啦', '测试', false, null, () => { called++; });
  w.document.getElementById('modalOk').click();
  assert.equal(called, 1, '点确定触发重置回调');
});
