/* 宠物：合并策略 / 喂食兜底 / 同步创建与 409 重试 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIndex, loadPetJs, sleep } from './lib.mjs';

const PHONE = '13800000000';

async function setupPet(fetchImpl) {
  const w = await loadIndex({ fetch: fetchImpl });
  loadPetJs(w);
  w.currentUser = PHONE;
  w.sessionRole = 'kid';
  w.localStorage.setItem('sp_gh_token', 'tok');
  return w;
}

test('petMerge：陪伴起始日取最早（天数只增不减）', async () => {
  const w = await setupPet();
  const m = w.petMerge(
    { created: '2026-10-08', updatedAt: 1000, coins: 1, eaten: 1 },
    { created: '2026-10-17', updatedAt: 2000, coins: 2, eaten: 2 }
  );
  assert.equal(m.created, '2026-10-08');
});

test('petMerge：累计资源取大（不倒退）', async () => {
  const w = await setupPet();
  const m = w.petMerge(
    { coins: 30, eaten: 50, food: 2, cans: 1, strips: 0, hungryDays: 3, created: '2026-10-08', updatedAt: 1000 },
    { coins: 10, eaten: 2, food: 0, cans: 0, strips: 0, hungryDays: 0, created: '2026-10-08', updatedAt: 2000 }
  );
  assert.equal(m.coins, 30);
  assert.equal(m.eaten, 50);
  assert.equal(m.food, 2);
  assert.equal(m.hungryDays, 3);
});

test('petMerge：当日状态（今日已喂/抚摸/玩具）按较新侧，不取大', async () => {
  const w = await setupPet();
  const m = w.petMerge(
    { fedToday: 2, patN: 5, toyN: { ball: 3 }, created: '2026-10-08', updatedAt: 1000, coins: 1 },
    { fedToday: 0, patN: 0, toyN: {}, created: '2026-10-08', updatedAt: 2000, coins: 1 }
  );
  assert.equal(m.fedToday, 0);
  assert.equal(m.patN, 0);
  assert.equal(Object.keys(m.toyN).length, 0, '玩具今日计数应按较新侧清空');
});

test('petMerge：已拥有/玩具并集；摆放（可逆状态）按较新侧且只保留已拥有', async () => {
  const w = await setupPet();
  const m = w.petMerge(
    { owned: { bed1: true }, toys: ['ball1'], placed: ['bed1', 'tree1'], created: '2026-10-08', updatedAt: 1000, coins: 1 },
    { owned: { tree1: true }, toys: ['ball2'], placed: ['bed1'], created: '2026-10-08', updatedAt: 2000, coins: 1 }
  );
  assert.ok(m.owned.bed1 && m.owned.tree1, '已拥有取并集');
  assert.ok(m.toys.includes('ball1') && m.toys.includes('ball2'), '玩具取并集');
  assert.equal(JSON.stringify(m.placed), JSON.stringify(['bed1']), '摆放按较新侧（tree1 已被收起）');
  const m2 = w.petMerge(
    { owned: {}, placed: ['ghost'], created: '2026-10-08', updatedAt: 1000, coins: 1 },
    { owned: {}, placed: [], created: '2026-10-08', updatedAt: 2000, coins: 1 }
  );
  assert.equal(m2.placed.length, 0, '未拥有的摆放项被过滤');
});

test('ptRoll：lastVisit 已是今天但 fedToday 残留时，按最后喂食日纠正', async () => {
  const w = await setupPet();
  w.localStorage.setItem('sp_pet__' + PHONE, JSON.stringify({
    name: '团子', coins: 0, food: 0, created: '2026-10-08',
    lastVisit: w.today(), lastFeed: '2026-10-28', fedToday: 2, updatedAt: 1
  }));
  const st = w.ptLoad();
  assert.equal(st.fedToday, 0, '残留的今日已喂应归零');
});

test('ptRoll：今天确实喂过则保留 fedToday', async () => {
  const w = await setupPet();
  w.ptLoadedKey = '';
  w.localStorage.setItem('sp_pet__' + PHONE, JSON.stringify({
    name: '团子', coins: 0, food: 0, created: '2026-10-08',
    lastVisit: w.today(), lastFeed: w.today(), fedToday: 2, updatedAt: 1
  }));
  const st = w.ptLoad();
  assert.equal(st.fedToday, 2);
});

test('宠物同步：首次创建不带空 sha（GitHub 严格校验下也成功）', async () => {
  let cloud = null, sha = null, puts = 0;
  const w = await setupPet((url, opt) => {
    const u = String(url), method = (opt || {}).method || 'GET';
    if (u.indexOf('sync-pet.json') < 0) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    if (method === 'GET'){
      if (!cloud) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ sha, content: Buffer.from(JSON.stringify(cloud)).toString('base64') }) });
    }
    const body = JSON.parse(opt.body); puts++;
    if ('sha' in body && !body.sha) return Promise.resolve({ ok: false, status: 422, json: () => Promise.resolve({ message: 'Invalid request. sha is not a valid blob sha.' }) });
    if (cloud && body.sha !== sha) return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ message: 'mismatch' }) });
    cloud = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    sha = 'sha-' + puts;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  });
  const st = w.ptLoad();
  st.coins = 88; st.name = '团子';
  w.ptSave();
  await sleep(5400);
  assert.equal(puts, 1, '应完成一次推送');
  assert.ok(cloud && cloud[PHONE] && cloud[PHONE].coins === 88, '云端数据正确');
  assert.equal(w.hasPetPending(), false, '成功后清除待推标记');
});

test('宠物同步：409 冲突自动重新拉取合并后重试', async () => {
  let cloud = null, sha = null, puts = 0, first = true;
  const w = await setupPet((url, opt) => {
    const u = String(url), method = (opt || {}).method || 'GET';
    if (u.indexOf('sync-pet.json') < 0) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    if (method === 'GET'){
      if (!cloud) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ sha, content: Buffer.from(JSON.stringify(cloud)).toString('base64') }) });
    }
    const body = JSON.parse(opt.body); puts++;
    if (first){ /* 模拟并发写入撞车 */
      first = false;
      cloud = { [PHONE]: { coins: 99, eaten: 50, created: '2026-10-08', updatedAt: 3000, owned: {}, toys: [], placed: [], toyN: {}, patN: 0, name: '团子' } };
      sha = 'sha-new';
      return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ message: 'sync-pet.json does not match ' + sha }) });
    }
    if (cloud && body.sha !== sha) return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ message: 'mismatch' }) });
    cloud = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
    sha = 'sha-' + puts;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  });
  cloud = { [PHONE]: { coins: 10, eaten: 5, created: '2026-10-20', updatedAt: 1000, owned: {}, toys: [], placed: [], toyN: {}, patN: 0, name: '旧名' } };
  sha = 'sha-init';
  w.localStorage.setItem('sp_pet__' + PHONE, JSON.stringify({ coins: 50, eaten: 8, created: '2026-10-08', updatedAt: 2000, owned: {}, toys: [], placed: [], toyN: {}, patN: 0, name: '团子' }));
  w.localStorage.setItem('sp_pet_sync_pending', '1');
  w.petSyncPush();
  await sleep(700);
  assert.equal(puts, 2, '409 后应自动重试一次');
  assert.equal(cloud[PHONE].coins, 99, '合并取大');
  assert.equal(cloud[PHONE].created, '2026-10-08', '陪伴起始取最早');
});
