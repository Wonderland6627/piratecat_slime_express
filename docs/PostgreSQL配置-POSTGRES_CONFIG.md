# PostgreSQL 连接

业务数据在云服本机 PostgreSQL。连接逻辑在 `config/database.js` 和 `utils/db.js`，服务启动后异步预热连接池。

## 当前用法

本地和云服都使用连接串：

```env
DATABASE_URL=postgresql://用户:密码@主机:端口/库名
```

| 环境 | 推荐连接串 |
| --- | --- |
| 正式服（云服本机） | `postgresql://slime_prod_user:...@127.0.0.1:5432/slime_prod` |
| 测试服（云服本机） | `postgresql://slime_dev_user:...@127.0.0.1:5432/slime_dev` |
| 本地开发（经 SSH 隧道） | `postgresql://slime_dev_user:...@127.0.0.1:15432/slime_dev` |

首次在云服安装时运行：

```bash
cd /www/apps/slime-express/piratecat_slime_express_dev
sudo bash scripts/setup-postgres-ubuntu.sh
```

脚本会打印两行可直接复制到 `.env` 的 `DATABASE_URL`，并保存到 `/root/slime-postgres-credentials.txt`。

## 表

只使用一张表：

- `user_game_infos`：用户档，按 `open_id` 唯一查询；排行榜走部分索引

关卡配置不在数据库中，客户端读取本地 `levels.json`。

## 安全

- PostgreSQL 只监听 `127.0.0.1:5432`，不对公网开放
- 正式库与测试库账号密码隔离
- 本地开发双击 `scripts/start-local-dev.bat`：先走 SSH 隧道，再启动本地服，不暴露数据库端口。只开隧道时用 `scripts/start-dev-db-tunnel.bat`

## 备份

每日备份脚本：`scripts/backup-postgres.sh`  
建议在宝塔「计划任务」每天 04:00 执行。脚本不会自己注册计划任务。2026-11-23 核对时，云服 crontab 里没有这条备份，`/www/backup/postgres` 是空目录。
