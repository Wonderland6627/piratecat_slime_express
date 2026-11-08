# Slime Express

小游戏后端，Express 进程，业务数据在腾讯云开发（CloudBase）文档数据库。

线上环境、机器规格、域名、部署目录和对象存储写在 `docs/ops.local.md`。该文件不入库。分析部署、容量或资源放在哪里时，先读这个文件。

域名、CDN、服务器、部署目录或发布方式发生变化时，同一次改动里更新两处：

- `docs/ops.local.md`：写下新的地址、规格、目录、存储桶和域名对应关系。
- 本 `README.md`：开发时要知道的入口如果变了，改掉对应说明，包括该读哪份备忘、本地怎么启动、现行发布方式是什么。

具体地址和机器规格留在 `docs/ops.local.md`。README 保持指向正确，后续开发按这两份文件的当前内容判断服务器情况。

## 本地启动

需要 Node.js 20。在 `piratecat_slime_express` 目录：

```bash
npm install
npm start
```

启动前准备 `.env`。该文件已在 `.gitignore` 中，变量说明见 [环境配置](./docs/环境配置-ENV_SETUP.md)。本地联调 Editor 登录时至少包括：

```env
NODE_ENV=development
ENABLE_TEST_MODE=true
TCB_ENV=云开发环境ID
TOKEN_SECRET=本地随机串
TCB_SECRET_ID=
TCB_SECRET_KEY=
WX_APPID=
WX_SECRET=
```

服务默认监听 `http://localhost:3000`，可用环境变量 `PORT` 覆盖。启动后访问 `GET /health` 确认进程起来了。

密钥只放 `.env` 和服务器上的环境变量，不要写进文档。

## 代码结构

```
routes/        路由
controllers/   请求与响应
services/      业务逻辑
middlewares/   认证、校验、错误处理
utils/         数据库、日志、第三方调用
config/        配置
```

接口字段和联调步骤看 [快速开始](./docs/快速开始-QUICK_START.md) 和 [接口参考](./docs/接口参考-API_REFERENCE.md)。成功响应是 `{ "code": 0, "data": {}, "msg": "success" }`。

## 文档

- [文档索引](./docs/文档索引-服务端.md)
- [快速开始](./docs/快速开始-QUICK_START.md)
- [环境配置](./docs/环境配置-ENV_SETUP.md)
- [认证指南](./docs/认证指南-AUTH_GUIDE.md)
- [接口参考](./docs/接口参考-API_REFERENCE.md)
- [日志使用指南](./docs/日志使用指南-LOGGER_USAGE.md)

现行部署见 `docs/ops.local.md`。仓库中的 `Dockerfile` 是早期云托管镜像，不是现在的发布方式。
