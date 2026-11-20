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
  assert.equal(rec.length, 3, '注意力 / 抑制 / 追踪搜索 三类各 1 个');
  assert.ok(['schulte', 'track', 'cancel'].includes(rec[0]));
  assert.ok(['stroop', 'switch'].includes(rec[1]));
  assert.ok(['mot', 'diff'].includes(rec[2]));
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
  assert.equal(w.document.getElementById('recTrend'), null, '近十次走势区已移除');
  /* 历史列表整页平铺：不应有内部滚动限高 */
  assert.ok(!w.document.getElementById('histList').style.maxHeight, '列表不应设置内部滚动高度');
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

test('专注页：连续达标成就——3局达标解锁、未达标清零', async () => {
  const w = await loadFocus({ url: 'https://star.test/?acct=ach' });
  w.localStorage.setItem('sp_fx__ach:ach.streak', '0');
  assert.equal(w.maybeAchieve(true), '');   // 第 1 局
  assert.equal(w.maybeAchieve(true), '');   // 第 2 局
  assert.ok(w.maybeAchieve(true).includes('连续 3 局达标'), '第 3 局应解锁成就');
  assert.equal(w.maybeAchieve(false), '', '未达标应清零且无成就');
  assert.equal(w.maybeAchieve(true), '', '清零后重新计数');
});


test('专注页：24点/记忆翻牌/空间方块页签已移除', async () => {
  const w = await loadFocus();
  const tabs = [...w.document.querySelectorAll('#tabs .tab')].map((b) => b.dataset.tab);
  assert.ok(!tabs.includes('p24'), '24点应移出');
  assert.ok(!tabs.includes('memory'), '记忆翻牌应移出');
  assert.ok(!tabs.includes('corsi'), '空间方块应移出');
  assert.ok(tabs.includes('schulte') && tabs.includes('track') && tabs.includes('cancel') && tabs.includes('stroop') && tabs.includes('switch'));
});

test('找不同：生成左右网格且差异数与难度一致', async () => {
  const w = await loadFocus();
  [1, 2, 3].forEach((lv) => {
    w.dfState.level = lv;
    w.dfDeal();
    const cfg = lv === 3 ? { size: 6, need: 5 } : lv === 2 ? { size: 5, need: 4 } : { size: 4, need: 3 };
    assert.equal(w.dfState.size, cfg.size, '尺寸正确');
    assert.equal(w.dfState.need, cfg.need, '差异数正确');
    const diffs = Object.keys(w.dfState.diffSet).length;
    assert.equal(diffs, cfg.need, '实际差异数一致');
    const cells = w.document.querySelectorAll('#dfWrap .df-cell');
    assert.equal(cells.length, cfg.size * cfg.size * 2, '左右两幅网格格子总数');
    /* 差异位置确实不同 */
    Object.keys(w.dfState.diffSet).forEach((k) => {
      assert.notEqual(w.dfState.left[+k], w.dfState.right[+k], '差异格内容不同');
    });
  });
});

test('找不同：点对差异计数、点错记错误', async () => {
  const w = await loadFocus();
  w.dfState.level = 1;
  w.dfDeal();
  w.dfState.started = true;
  const diffIdx = Object.keys(w.dfState.diffSet).map(Number);
  const sameIdx = w.dfState.right.map((_, i) => i).find((i) => !w.dfState.diffSet[i]);
  const cell = (i) => w.document.querySelector('#dfWrap .df-cell[data-side="R"][data-i="' + i + '"]');
  cell(sameIdx).click();
  assert.equal(w.dfState.errors, 1, '点错记错误');
  diffIdx.forEach((i) => cell(i).click());
  assert.equal(w.dfState.found, w.dfState.need, '全部差异找到');
});

test('多目标追踪：球数与目标数随轮次递增', async () => {
  const w = await loadFocus();
  w.motSt.round = 0;
  w.motNextRound(); /* 第 1 轮：8 球 / 2 目标 */
  assert.equal(w.motSt.balls.length, 8);
  assert.equal(w.motSt.balls.filter((b) => b.isTarget).length, 2);
  w.motSt.phase = 'memo';
  w.motNextRound(); /* 第 2 轮：9 球 / 3 目标 */
  assert.equal(w.motSt.balls.length, 9);
  assert.equal(w.motSt.balls.filter((b) => b.isTarget).length, 3);
});

test('多目标追踪：选错结束本局并记录轮数', async () => {
  const w = await loadFocus();
  w.motSt.round = 0;
  w.motNextRound();
  w.motSt.phase = 'select';
  w.motSt.balls.forEach((b) => { b.picked = !b.isTarget; }); /* 全选错 */
  w.motSubmit();
  assert.equal(w.motSt.phase, 'idle', '判定失败后结束');
  const hist = JSON.parse(w.localStorage.getItem('sp_fx__local:history') || '[]');
  const rec = hist.find((r) => r.g === 'mot');
  assert.ok(rec, '应写入多目标追踪记录');
  assert.equal(rec.v, 1, '记录通过轮数');
});
