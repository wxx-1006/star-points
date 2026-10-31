# 同步策略
- 代码仓库（本仓库）：只放代码，不含任何用户数据与 token
- 数据仓库：私有仓库 star-points-data 的 sync-data.json，按手机号为键，last-write-wins
- Token：Fine-grained PAT（仅授权 star-points-data 的 Contents 读写），在 App 设置页「云端同步」手动输入，存本机 localStorage（sp_gh_token），永不入库
- 无 token：应用纯本地运行；token 失效：色点变红提示重新填写，本地数据不受影响


## 当前实现（2026-10-31 起）

- **5 条云端通道**（同一数据仓库，不同文件）：账本 `sync-data.json`、打卡 `sync-checkin.json`、宠物 `sync-pet.json`、专注 `sync-focus.json`、兑换申请 `requests.json`
- **统一同步层**：所有写入都走 `ghApiGet` / `ghApiPut` / `syncChannelPush`（见 `index.html`），统一处理
  - 404 = 文件尚未创建 → 视为空数据，走创建流程（**不带空 sha**，否则 GitHub 返回 422）
  - 409 = sha 冲突（并发写入）→ 重新拉取最新内容、合并后再推（最多 3~4 次）
  - 失败 → 记录 pending 标记 + 保留 GitHub 原始错误 message，下次保存/进页/切回时自动重试
- **合并策略（绝不用覆盖）**：
  | 通道 | 合并规则 |
  |---|---|
  | 账本 | 记录级并集 + 删除墓碑（墓碑命中的记录不复活）+ 总分按流水重算 |
  | 打卡 | 状态字段只进不退（完成/扣分标记取大、申请按操作时间取新） |
  | 宠物 | 陪伴起始日取最早、累计资源取大、当日状态（今日已喂/抚摸/玩具）按较新侧、摆放按较新侧、已拥有与玩具并集 |
  | 专注 | 每个游戏各自取更好纪录 |
  | 兑换申请 | 整体写入（last-write-wins，家庭规模可接受） |
- **拉取一律合并**：任何情况下都不会用云端快照直接覆盖本地（本地未推的改动不会因一次刷新丢失）

## 当前决策（2026-10-31）

**继续使用 Git（GitHub 私有仓库）方案，暂不迁移到自建/云后端。**
下面这节是"将来若要换后端"的迁移说明，属于备用参考，不是待办事项。
Git 方案下的运维要点：
1. Token 权限最小化（仅授权 star-points-data 仓库的 Contents 读写），不要用全权限 PAT；
2. 定期在设置页「导出备份」（现已含账本/打卡/宠物/专注/刷题/题库），作为本地兜底；
3. 避免多台设备同时高频操作同一通道（Git 无事务，仍可能 409——已自动重试合并，但减少并发更省事）；
4. 出现同步异常先看设置页「数据体检」的通道状态，再决定重试或导出备份。

## 切换到正式后端时（备用参考）

统一同步层已把「读写 GitHub Contents API」收敛到 4 个底层函数（`ghApiGet` / `ghApiPut` / `syncChannelPush` / `syncChannelPull`），
更换后端时**只需替换这 4 个函数**（改为调用自建 API / 云数据库 SDK），各业务通道的合并规则与 UI 无需改动：

```js
// 迁移点：index.html 中这 4 个函数
function ghApiGet(api){...}      // → 改为 GET /api/files/:name
function ghApiPut(api,obj,sha,msg){...} // → 改为 PUT /api/files/:name（去掉 sha 概念）
function syncChannelPush(opts){...}    // 保持不变（内部调用上面两个）
function syncChannelPull(opts){...}    // 保持不变
```

迁移前建议先在现架构下跑通 `npm test`（47 项回归），迁移后复跑即可验证行为未变。
