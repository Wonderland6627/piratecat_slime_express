# 快速开始

## 1. 安装与启动

需要 Node.js 20。

```bash
npm install
npm start
```

默认地址：`http://localhost:3000`。环境变量见 [环境配置](./环境配置-ENV_SETUP.md)。

本地联调至少：

```env
NODE_ENV=development
ENABLE_TEST_MODE=true
TOKEN_SECRET=本地随机串
DATABASE_URL=postgresql://slime_dev_user:密码@127.0.0.1:15432/slime_dev
```

连云服测试库时双击 `scripts/local/start-local-dev.bat`（先开隧道，再启动本地服）。只开隧道时用 `scripts/local/start-dev-db-tunnel.bat`。

## 2. Editor 登录

`platform` 会转成小写，测试模式未打开时 `editor` 不可用。下面是 bash。

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/minigame/getCode2Session \
  -H "Content-Type: application/json" \
  -d '{"platform":"editor","code":"local_test_user"}' | jq -r '.data.token')

curl -X POST http://localhost:3000/api/minigame/getUserGameInfoV2 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}"

curl -X POST http://localhost:3000/api/minigame/updateResource \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"resourceType":1,"change":100,"source":"debug_add_coin"}'
```

第一次 `getUserGameInfoV2` 会建档。没带 Token 时返回 `Authentication required. Please provide a valid token.`

## 3. 接口

业务接口前缀 `/api/minigame`，全部是 POST，除登录外都要 Token。

- `getCode2Session`
- `getUserWXContext`
- `getUserGameInfoV2`
- `setUserGameInfoV2`
- `debugSetUserGameInfo`（还要测试模式）
- `getUserRankListV2`
- `updateResource`
- `getResources`
- `claimLevelReward`
- `claimDailyCheckin`
- `claimLevelChest`
- `claimAdsGiftPack`

`getLevelsConfigV2` 已废弃（返回 404），关卡由客户端本地 `levels.json` 加载。

另外：`GET /health`（进程还在）、`GET /ready`（数据库能查）、`GET /api/version`、`POST /api/time`。

改完配置表、代码或数据库后怎么重启，看 [后端操作手册](./后端操作手册-OPS_PLAYBOOK.md)。

字段见 [接口参考](./接口参考-API_REFERENCE.md)，登录规则见 [认证指南](./认证指南-AUTH_GUIDE.md)。线上地址在 `ops.local.md`。
