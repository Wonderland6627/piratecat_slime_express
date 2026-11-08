# 日志

实现在 `utils/logger.js`。Winston 写文件和控制台，Morgan 把访问行送进同一个 logger。

## 文件

目录是项目根下的 `logs/`。按小时切分，单文件超过 20MB 会再切，保留 30 天，不压缩。

```
logs/
└── 2026-11-08/
    └── server-2026-11-08-14.log
```

一行的格式：

```text
2026-11-08 14:35:22.456 [I] [INFO]: User login success {"openid":"..."}
```

级别标记：`[E]` `[W]` `[I]` `[H]` `[D]`。正式环境（`NODE_ENV` 为 `production` 或 `release`）记录到 `http`，其他环境记录到 `debug`。

`/health` 和 `/api/version` 不写访问日志。`authorization`、`token`、`secret`、`wx_secret` 等字段会脱敏。

## 怎么打

```javascript
const { logger } = require('../utils/logger');

logger.info('User login success', { openid, platform });
logger.warn('Config missing', { key: 'TCB_ENV' });
logger.error('Database insert failed', { error: err.message });
```

请求体、响应体是否写入，由 `HTTP_LOG_DETAIL_MODE`、`HTTP_LOG_INCLUDE_BODY`、`HTTP_LOG_INCLUDE_RESPONSE` 控制，说明见 [环境配置](./环境配置-ENV_SETUP.md)。正式环境默认只给 4xx/5xx 补详情。

日志在各自项目目录里，占的是那台机器的系统盘。
