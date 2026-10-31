/* 测试公共库：统一加载 index.html / pet.js / focus.html 到 jsdom，并提供断言辅助 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const INDEX_PATH = path.join(ROOT, 'index.html');
export const PET_PATH = path.join(ROOT, 'pet.js');
export const FOCUS_PATH = path.join(ROOT, 'focus.html');

export const notFoundFetch = () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });

/** 加载 index.html 到 jsdom（默认 fetch 全部 404，不触网） */
export async function loadIndex(opts = {}) {
  const html = readFileSync(INDEX_PATH, 'utf8');
  const dom = new JSDOM(html, {
    url: opts.url || 'https://star.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) { w.fetch = opts.fetch || notFoundFetch; }
  });
  await new Promise((r) => setTimeout(r, 300));
  return dom.window;
}

/** 加载 focus.html 到 jsdom */
export async function loadFocus(opts = {}) {
  const html = readFileSync(FOCUS_PATH, 'utf8');
  const dom = new JSDOM(html, {
    url: opts.url || 'https://star.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) { w.fetch = opts.fetch || notFoundFetch; }
  });
  await new Promise((r) => setTimeout(r, 300));
  return dom.window;
}

/** 在已加载的 index 窗口里再执行 pet.js（宠物是外部脚本） */
export function loadPetJs(w) {
  w.eval(readFileSync(PET_PATH, 'utf8'));
  return w;
}

/** 构造一份可用的账本（ad） */
export function mkAd(extra = {}) {
  return Object.assign({
    records: [], exchanges: [], totalPoints: 0, del: {},
    quizStreak: {}, upItems: [], downItems: [], shopItems: {}
  }, extra);
}

/** 打卡任务配置：写入本地桶 */
export function seedCkTasks(w, phone, tasks) {
  w.localStorage.setItem('sp_ck__' + phone, JSON.stringify({ _cfg: { tasks, t: Date.now() } }));
}

/** 记一条流水 */
export function rec(w, o) {
  return Object.assign({ id: 'r' + Math.random().toString(36).slice(2, 8), date: w.today(), timestamp: Date.now(), type: 'up', category: '学习', score: 1, name: '测试' }, o);
}

/** 等待若干毫秒 */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
