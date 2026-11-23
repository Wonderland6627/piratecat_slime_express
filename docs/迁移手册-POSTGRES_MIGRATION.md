# CloudBase → PostgreSQL 迁移手册（后端新手版）

按顺序做。代码与脚本已在仓库中准备好。

## 第 1 步：云服安装 PostgreSQL

1. 宝塔「文件」进入 `/www/apps/slime-express/piratecat_slime_express_dev`，确认已有最新代码（含 `scripts/`、`sql/`）。
2. 宝塔「终端」执行：

```bash
cd /www/apps/slime-express/piratecat_slime_express_dev
sudo bash scripts/postgres/setup-postgres-ubuntu.sh
```

3. 把终端打印的两行 `DATABASE_URL` 复制到本地记事本保存。

角色已经存在时，再跑这个脚本不会改密码，也不会覆盖 `/root/slime-postgres-credentials.txt`。改表不要靠重跑安装脚本，用 `scripts/ops/server-ops.sh` 的 `apply-sql`。

## 第 2 步：先切测试服

1. 覆盖测试服代码（不要覆盖 `.env`、`logs/`）。
2. 编辑测试服 `.env`：删除/注释 `TCB_*`，粘贴测试服 `DATABASE_URL`。
3. 终端执行：

```bash
cd /www/apps/slime-express/piratecat_slime_express_dev
npm install --omit=dev
```

4. 宝塔「网站 → Node项目」重启测试服。
5. 打开 `https://dev.slime.piratecat.top/health`；日志出现 `[PostgreSQL] Connected successfully` 即成功。

## 第 3 步：本地连测试库

1. 双击 `scripts/local/start-dev-db-tunnel.bat`，窗口不要关。
2. 本地 `.env` 使用端口 `15432` 的测试服连接串。
3. `npm start`，Unity Editor 测登录/体力/通关/签到/宝箱/排行榜。

## 第 4 步：导入正式老数据

1. 把 CloudBase 导出的 JSONL 上传到云服 `/tmp/users_export.json`。
2. 演习：

```bash
cd /www/apps/slime-express/piratecat_slime_express_dev
node scripts/postgres/import-cloudbase-data.js /tmp/users_export.json --dry-run
```

3. 正式写入：

```bash
DATABASE_URL="正式服连接串" node scripts/postgres/import-cloudbase-data.js /tmp/users_export.json
```

4. 核对总人数与 top-5 后删除 `/tmp/users_export.json`。

导入可以对已经有数据的库再跑。同一个 `openID` 会保留库里已有的昵称、头像、金币和物品，只补导出里多出来的空缺；关卡取较大值，已领宝箱取并集。它不会把线上存档刷回旧快照。

## 第 5 步：切正式服

1. 备份正式服目录为 `piratecat_slime_express_bak`。
2. 覆盖新代码，编辑正式服 `.env`：去掉 `TCB_*`，粘贴正式服 `DATABASE_URL`。
3. **不要改 `TOKEN_SECRET`**。
4. `npm install --omit=dev` 后重启正式服 Node 项目。
5. 手机微信真机验收登录、进度、金币、排行榜、领奖。

## 第 6 步：备份与退订 CloudBase

1. 宝塔「计划任务」每天 04:00：

```bash
bash /www/apps/slime-express/piratecat_slime_express/scripts/postgres/backup-postgres.sh
```

2. 正式服稳定 1~3 天后，到腾讯云销毁 CloudBase 环境 `slimecloudservice-6enxmrfbc5bddc`。

## 回滚

未退订 CloudBase 前，若正式服异常：把目录换回 `piratecat_slime_express_bak` 并重启 Node 项目即可回到旧链路。
