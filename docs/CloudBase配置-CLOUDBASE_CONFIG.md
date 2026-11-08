# CloudBase 连接

业务数据在 CloudBase 文档数据库。连接逻辑在 `config/database.js` 和 `utils/cloudbaseDB.js`，第一次访问数据库时才初始化。

## 当前用法

本地和现在的服务器都使用密钥：

```env
TCB_ENV=云开发环境ID
TCB_SECRET_ID=
TCB_SECRET_KEY=
```

两个密钥都存在时，启动日志里的认证方式是 `SecretKey`。缺了密钥时，SDK 会尝试服务角色；那只在腾讯云托管里有效。当前进程不跑在云托管里，缺密钥会连不上。

环境 ID 决定连哪一个 CloudBase 环境，和进程部署在哪台机器无关。

## 集合

- `UserGameInfos`：用户档，按 `openID` 查询
- `Levels`：`getLevelsConfigV2` 读取的关卡文档

控制台里的环境列表用来核对环境 ID。具体环境见 `ops.local.md`，不要把 ID 和密钥写进会提交的文档。
