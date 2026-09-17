# 同步策略
- 代码仓库（本仓库）：只放代码，不含任何用户数据与 token
- 数据仓库：私有仓库 star-points-data 的 sync-data.json，按手机号为键，last-write-wins
- Token：Fine-grained PAT（仅授权 star-points-data 的 Contents 读写），在 App 设置页「云端同步」手动输入，存本机 localStorage（sp_gh_token），永不入库
- 无 token：应用纯本地运行；token 失效：色点变红提示重新填写，本地数据不受影响
