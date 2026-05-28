const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3500;
const DATA_DIR = path.join(__dirname, 'data');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json());
app.use(express.text());

// Serve 前端 HTML
app.use(express.static(path.join(__dirname, '..')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function userFile(phone) {
  const safe = phone.replace(/[^0-9]/g, '');
  return path.join(DATA_DIR, safe + '.json');
}

// GET /sync?phone=13800001111
app.get('/sync', (req, res) => {
  const phone = req.query.phone;
  if (!phone || phone.length < 7) {
    return res.status(400).json({ error: '缺少手机号' });
  }
  const fp = userFile(phone);
  if (!fs.existsSync(fp)) {
    return res.json({ phone, data: null });
  }
  try {
    const raw = fs.readFileSync(fp, 'utf-8');
    const data = JSON.parse(raw);
    res.json({ phone, data, updatedAt: data._updatedAt || null });
  } catch (e) {
    res.status(500).json({ error: '读取数据失败' });
  }
});

// POST /sync
app.post('/sync', (req, res) => {
  const { phone, data } = req.body;
  if (!phone || phone.length < 7) {
    return res.status(400).json({ error: '缺少手机号' });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: '缺少数据' });
  }
  const fp = userFile(phone);
  try {
    data._updatedAt = new Date().toISOString();
    fs.writeFileSync(fp, JSON.stringify(data), 'utf-8');
    res.json({ ok: true, updatedAt: data._updatedAt });
  } catch (e) {
    res.status(500).json({ error: '写入失败' });
  }
});

// GET /health
app.get('/health', (req, res) => {
  const files = fs.readdirSync(DATA_DIR);
  res.json({ ok: true, users: files.length, time: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`⭐ 星星积分同步服务已启动 http://0.0.0.0:${PORT}`);
  console.log(`   浏览器访问: http://<服务器IP>:${PORT}`);
  console.log(`   GET  /sync?phone=xxx  拉取数据`);
  console.log(`   POST /sync            上传数据`);
  console.log(`   GET  /health          健康检查`);
});
