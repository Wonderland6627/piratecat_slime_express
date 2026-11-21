# 环境配置

变量放在项目根目录的 `.env`，或由进程管理器注入。`.env` 已在 `.gitignore` 中。线上两套环境各自一份，位置见 `ops.local.md`。

## 本地最小配置

Editor 登录并连接云服测试库（经 SSH 隧道）时使用：

```env
NODE_ENV=development
ENABLE_TEST_MODE=true
TOKEN_SECRET=本地随机串
DATABASE_URL=postgresql://slime_dev_user:密码@127.0.0.1:15432/slime_dev
```

微信登录再加：

```env
WX_APPID=
WX_SECRET=
```

本地连云服测试库前，先双击运行 `scripts/start-dev-db-tunnel.bat`，保持窗口不关。

## 变量

| 变量 | 作用 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串。优先使用。格式：`postgresql://用户:密码@主机:端口/库名` |
| `PG_HOST` / `PG_PORT` / `PG_DATABASE` / `PG_USER` / `PG_PASSWORD` | 拆分写法，未设置 `DATABASE_URL` 时生效 |
| `PG_SSL` | 设为 `true` 时启用 SSL（本机隧道场景一般不需要） |
| `PG_POOL_MAX` | 连接池上限，默认 `5`（适配 2C2G） |
| `WX_APPID` / `WX_SECRET` | 微信 `jscode2session`。只有 `platform=wechat` 时需要 |
| `TOKEN_SECRET` | JWT 签名密钥。`NODE_ENV` 为 `production` 或 `release` 时必须设置，否则进程启动失败 |
| `NODE_ENV` | `development` 打更详细的日志。`production` / `release` 视为正式环境 |
| `ENABLE_TEST_MODE` | 必须是字符串 `true` 才允许 `editor` 登录 |
| `TEST_OPENID` | Editor 未传 `code` 时的默认 openid |
| `PORT` | 监听端口，默认 `3000` |
| `BUILD_TIME` | 写入 `/api/version` 的构建时间。不配则用本次进程启动时间 |
| `GIT_COMMIT_SHA` | 写入 `/api/version` 的版本标识，也认 `COMMIT_SHA`、`RELEASE_VERSION`、`IMAGE_TAG` |
| `HTTP_LOG_DETAIL_MODE` | `detailed` 或 `errors`。正式环境默认 `errors` |
| `HTTP_LOG_INCLUDE_BODY` | `true` 时记录请求体 |
| `HTTP_LOG_INCLUDE_RESPONSE` | `true` 时记录响应体 |

已废弃（可删除）：`TCB_ENV`、`ENV_ID`、`TCB_SECRET_ID`、`TCB_SECRET_KEY`。

`LOG_COS_PREFIX`、`LOG_SERVICE_NAME` 当前没有被代码读取。

## 正式环境

```env
NODE_ENV=production
ENABLE_TEST_MODE=false
TOKEN_SECRET=强随机串
DATABASE_URL=postgresql://slime_prod_user:密码@127.0.0.1:5432/slime_prod
WX_APPID=
WX_SECRET=
```

正式环境不要打开 `ENABLE_TEST_MODE`。改完环境变量后需要重启对应进程。

**注意**：切换数据库时不要改 `TOKEN_SECRET`，否则线上玩家手机里缓存的 JWT 会全部失效，需要重新登录。

## 数据库

业务数据在云服本机 PostgreSQL：

- 正式库：`slime_prod`（仅正式服本机访问）
- 测试库：`slime_dev`（云端测试服 + 本地开发经 SSH 隧道共用）

唯一业务表：`user_game_infos`。

关卡数值、签到和宝箱奖励来自仓库里的 Luban 配置（`config/luban`），不在数据库里。
