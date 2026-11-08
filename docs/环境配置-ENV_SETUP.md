# 环境配置

变量放在项目根目录的 `.env`，或由进程管理器注入。`.env` 已在 `.gitignore` 中。线上两套环境各自一份，位置见 `ops.local.md`。

## 本地最小配置

Editor 登录和直连 CloudBase 时使用：

```env
NODE_ENV=development
ENABLE_TEST_MODE=true
TCB_ENV=云开发环境ID
TCB_SECRET_ID=
TCB_SECRET_KEY=
TOKEN_SECRET=本地随机串
```

微信登录再加：

```env
WX_APPID=
WX_SECRET=
```

`TCB_ENV` 也可以写成 `ENV_ID`，代码优先读 `TCB_ENV`。

## 变量

| 变量 | 作用 |
| --- | --- |
| `TCB_ENV` | CloudBase 环境 ID。不配时 SDK 可能落到账号里的默认环境 |
| `TCB_SECRET_ID` / `TCB_SECRET_KEY` | 访问 CloudBase 的密钥。本地和当前服务器都要配 |
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

`LOG_COS_PREFIX`、`LOG_SERVICE_NAME` 当前没有被代码读取。

## 正式环境

```env
NODE_ENV=production
ENABLE_TEST_MODE=false
TOKEN_SECRET=强随机串
TCB_ENV=
TCB_SECRET_ID=
TCB_SECRET_KEY=
WX_APPID=
WX_SECRET=
```

正式环境不要打开 `ENABLE_TEST_MODE`。改完环境变量后需要重启对应进程。

## 数据库集合

代码会访问这两个 CloudBase 集合：

- `UserGameInfos`
- `Levels`

关卡数值、签到和宝箱奖励来自仓库里的 Luban 配置（`config/luban`），不在这两个集合里。
