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

test('日历墙：当月每天一格，完成日点亮', async () => {
  const w = await setup();
  const b = w.ckBucket();
  b[w.today()] = b[w.today()] || {};
  b[w.today()]['6'] = { c: 1, d: 1, r: 1, t: Date.now() };
  w.ckSaveBucket(b);
  const html = w.ckCalendarHtml();
  assert.ok(html.includes('ck-cal'), '应渲染日历网格');
  assert.ok(html.includes('ck-cd on'), '完成日应点亮');
  assert.ok(/class="ck-cd[^"]*cur/.test(html), '所选日期应有高亮');
});

test('里程碑徽章：连续天数达标即点亮', async () => {
  const w = await setup();
  const b = w.ckBucket();
  for (const off of [0, 1, 2]) {
    const ds = w.ckAddDays(w.today(), -off);
    b[ds] = b[ds] || {};
    b[ds]['6'] = { c: 1, d: 1, r: 1, t: Date.now() };
  }
  w.ckSaveBucket(b);
  const html = w.ckBadgesHtml();
  const onCount = (html.match(/ck-badge on/g) || []).length;
  assert.equal(onCount, 1, '连续 3 天只点亮第一个徽章（3 天档）');
  assert.ok(html.includes('ck-badge-note') && html.includes('3 / 7 / 14 / 30'), '徽章应注明点亮天数');
});

test('满勤盲盒：上周 7 天全完成才可抽，抽一次后标记本周已抽', async () => {
  const w = await setup('parent');
  const b = w.ckBucket();
  const d = new Date();
  const dow = d.getDay();
  const back = dow === 0 ? 7 : dow;
  d.setDate(d.getDate() - back - 6); /* 上周一 */
  for (let i = 0; i < 7; i++) {
    const ds = w.ckFmtD(d);
    b[ds] = b[ds] || {};
    b[ds]['6'] = { c: 1, d: 1, r: 1, t: Date.now() };
    d.setDate(d.getDate() + 1);
  }
  w.ckSaveBucket(b);
  assert.equal(w.ckLastWeekFull(), true, '上周全勤');
  w.ckBlindboxOpen();
  const blind = w.ad.records.filter((r) => r.itemId === 'ck_blindbox');
  assert.equal(blind.length, 1, '应写入一条盲盒流水');
  assert.ok([5, 10, 20].includes(blind[0].score), '奖励为 5/10/20 之一');
  assert.equal(w.ad.ckBlindWeek, w.ckWeekTag(), '标记本周已抽');
  w.ckBlindboxOpen();
  assert.equal(w.ad.records.filter((r) => r.itemId === 'ck_blindbox').length, 1, '重复抽应被拦截');
});

test('满勤盲盒：上周未全勤不可抽', async () => {
  const w = await setup('parent');
  assert.equal(w.ckLastWeekFull(), false);
  w.ckBlindboxOpen();
  assert.equal(w.ad.records.filter((r) => r.itemId === 'ck_blindbox').length, 0);
});

test('满勤盲盒：孩子端不能抽（只能提示家长）', async () => {
  const w = await setup('kid');
  w.ad.ckBlindWeek = undefined;
  w.ckBlindboxOpen();
  assert.equal(w.ad.records.filter((r) => r.itemId === 'ck_blindbox').length, 0);
});

test('修改任务配置不影响历史：配置日之前的日期不再按新配置补扣', async () => {
  const w = await setup();
  w.localStorage.setItem('sp_ck__' + PHONE, JSON.stringify({ _cfg: { tasks: TASKS, t: Date.now() } })); /* 今天刚改配置 */
  w.ckMustSweep(new Date(w.today() + 'T00:30:00')); /* 尝试结算昨天 */
  const dsY = w.ckAddDays(w.today(), -1);
  const st = (w.ckBucket()[dsY] || {})['6'] || {};
  assert.notEqual(st.m, 1, '历史日期不应被新配置重算');
  assert.equal(w.ad.records.length, 0, '不应补扣历史');
});

test('回滚误扣：改配置后补扣的历史流水被删除且总分恢复', async () => {
  const w = await setup();
  const cfgT = Date.now() - 60000; /* 1 分钟前改的配置 */
  w.localStorage.setItem('sp_ck__' + PHONE, JSON.stringify({ _cfg: { tasks: TASKS, t: cfgT } }));
  const dsY = w.ckAddDays(w.today(), -1);
  w.ad.records.push({ id: 'ckm_' + dsY + '_6', date: dsY, timestamp: cfgT + 30000, type: 'down', itemId: 'ck_must', name: '误扣', category: '打卡', score: -5 });
  w.ad.records.push({ id: 'ok1', date: w.today(), timestamp: 1, type: 'up', category: '学习', name: '正常加分', score: 20 });
  w.ad.totalPoints = 15;
  const n = w.ckRollbackWrongPenalties();
  assert.equal(n, 1, '应回滚 1 条误扣');
  assert.equal(w.ad.records.filter((r) => r.id === 'ckm_' + dsY + '_6').length, 0, '误扣流水已删除');
  assert.equal(w.ad.totalPoints, 20, '总分恢复');
});

test('回滚误扣：配置日之前就存在的合法扣分不动', async () => {
  const w = await setup();
  const cfgT = Date.now();
  w.localStorage.setItem('sp_ck__' + PHONE, JSON.stringify({ _cfg: { tasks: TASKS, t: cfgT } }));
  const dsOld = w.ckAddDays(w.today(), -5);
  /* 合法扣分：产生于配置修改之前 */
  w.ad.records.push({ id: 'ckm_' + dsOld + '_6', date: dsOld, timestamp: cfgT - 86400000, type: 'down', itemId: 'ck_must', name: '合法扣分', category: '打卡', score: -5 });
  w.ad.totalPoints = -5;
  const n = w.ckRollbackWrongPenalties();
  assert.equal(n, 0, '不应回滚旧扣分');
  assert.equal(w.ad.records.length, 1);
});

test('日历：可翻上/下月，点日期后任务列表跟随该日期', async () => {
  const w = await setup();
  w.ckShow();
  const before = JSON.parse(JSON.stringify(w.ckCalYM));
  w.ckCalShift(-1);
  assert.equal(w.ckCalYM.m, (before.m + 11) % 12, '翻到上个月');
  w.ckCalShift(1);
  assert.equal(w.ckCalYM.m, before.m, '翻回本月');
  const target = w.ckAddDays(w.today(), -3);
  w.ckCalPick(target);
  assert.equal(w.ckDate, target, '所选日期生效');
});

test('徽章：9 档，连续 1000 天可点亮最后一档', async () => {
  const w = await setup();
  const b = w.ckBucket();
  for (let i = 0; i <= 1000; i++) {
    b[w.ckAddDays(w.today(), -i)] = { '6': { c: 1, d: 1, r: 1, t: Date.now() } };
  }
  w.ckSaveBucket(b);
  assert.equal(w.ckStreak(), 1001, '连续天数应能统计到 1000+');
  const html = w.ckBadgesHtml();
  assert.equal((html.match(/ck-badge on/g) || []).length, 9, '9 档全部点亮');
});

test('盲盒：按家长配置的奖励池抽取（不再硬编码 5/10/20）', async () => {
  const w = await setup('parent');
  const b = w.ckBucket();
  const d = new Date();
  const back = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - back - 6);
  for (let i = 0; i < 7; i++) {
    b[w.ckFmtD(d)] = { '6': { c: 1, d: 1, r: 1, t: Date.now() } };
    d.setDate(d.getDate() + 1);
  }
  w.ckSaveBucket(b);
  w.ad.ckBlindPool = [{ n: '宠物零食一份', p: 15 }];
  w.ckBlindboxOpen();
  const r = w.ad.records.find((x) => x.itemId === 'ck_blindbox');
  assert.ok(r, '应写入盲盒流水');
  assert.equal(r.score, 15, '采用配置的分值');
  assert.equal(r.name, '宠物零食一份', '采用配置的名称');
});

test('打卡页：顶部日期/进度/统计整块已移除（改由日历选日期）', async () => {
  const w = await setup();
  w.ckShow();
  const html = w.document.getElementById('ckList').innerHTML;
  assert.ok(!html.includes('ck-nav'), '不应再有 ‹ 日期 › 导航');
  assert.ok(!html.includes('ck-day-title'), '日期标题已移除');
  assert.ok(!html.includes('ck-prog'), '进度条已移除');
  assert.ok(!html.includes('ck-sum'), '完成/已得统计行已移除');
});
