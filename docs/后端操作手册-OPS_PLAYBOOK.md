# 后端操作手册

改完服务端之后，按这页做。先动测试服，游戏里确认过，再动正式服。

配置表、代码、`.env` 都是进程启动时读进去的。文件传上去以后，不重启就不会生效。

## 改了什么，就做什么

- 只改了 Luban 配置表：本机生成 JSON，上传 `config/luban`，然后重启，再检查。
- 改了 js 代码：上传改过的文件，然后重启，再检查。不要覆盖 `.env` 和 `logs/`。
- 改了 `package.json`：上传后先在该目录执行 `npm install --omit=dev`，再重启，再检查。
- 改了 `.env`：保存后只重启。正式服不要改 `TOKEN_SECRET`，否则玩家要重新登录。
- 新增了 `sql/00N_*.sql`：先把 SQL 灌进测试库，再上传用到新表结构的代码并重启。测试通过后对正式服重复。
- 只改了文档：不用上传业务文件，不用重启，不用跑脚本。

## 两个环境

| 你要动的 | 目录 | 数据库 | 地址 |
| --- | --- | --- | --- |
| 测试服 `dev` | `/www/apps/slime-express/piratecat_slime_express_dev` | `slime_dev` | `https://dev.slime.piratecat.top` |
| 正式服 `prod` | `/www/apps/slime-express/piratecat_slime_express` | `slime_prod` | `https://slime.piratecat.top` |

## 命令在哪执行

云服宝塔里打开终端，进入对应目录后执行。测试服例子：

```bash
cd /www/apps/slime-express/piratecat_slime_express_dev
bash scripts/server-ops.sh dev check
bash scripts/server-ops.sh dev restart
bash scripts/server-ops.sh dev apply-sql sql/002_xxx.sql
```

正式服把 `dev` 换成 `prod`，目录换成正式服目录。备份只对正式服：

```bash
bash scripts/server-ops.sh prod backup
```

自己电脑上也可以双击或在仓库里执行 `scripts\server-ops.bat`，它会 SSH 到云服跑同一条命令。第一次会问 SSH 密码。新脚本还不在服务器上时，先用宝塔把代码传上去，再跑。

```bat
scripts\server-ops.bat dev check
scripts\server-ops.bat dev restart
scripts\server-ops.bat prod restart
```

`restart` 会按目录找 pm2 进程。找不到就按它打印的路径，到宝塔「网站 → Node项目」里点重启，然后再跑一次 `check`。

## 只改了配置表

1. 在自己电脑上双击 `TEngine/Configs/GameConfig/gen_code_bin_to_server.bat`。
2. 它会把 JSON 写到 `piratecat_slime_express/config/luban/data`，代码写到 `config/luban/gen`。
3. 用宝塔把这两个目录上传到测试服。不要覆盖 `.env` 和 `logs/`。
4. 执行 `bash scripts/server-ops.sh dev restart`。
5. 执行 `bash scripts/server-ops.sh dev check`。
6. 用测试服进游戏，点一下这次改过的奖励、体力或宝箱。
7. 没问题后，把同样的 `config/luban` 上传到正式服，执行 `prod restart` 和 `prod check`。

`check` 里要看到：

- `/health` 是 `status: ok`。这只说明进程还在，不说明数据库是好的。
- `/ready` 是 `database: up`。
- `/api/version` 里的 `startedAt` 是刚才重启的时间。
- 日志里有 `Connected successfully` 和 `Luban config loaded`。

宝塔的探活继续用 `/health`。不要改成 `/ready`，否则数据库抖动时面板会把进程反复重启。

## 改了代码

1. 上传改过的文件到测试服。不要覆盖 `.env` 和 `logs/`。
2. 只有 `package.json` 变了，才在该目录执行 `npm install --omit=dev`。
3. `bash scripts/server-ops.sh dev restart`
4. `bash scripts/server-ops.sh dev check`
5. 在测试服把改过的功能点一遍。
6. 再对正式服做同样的上传、重启、检查。

## 改了数据库

1. 在仓库里新增 `sql/002_xxx.sql` 这种新文件。不要改已经在线上跑过的 `sql/001_init_schema.sql`。
2. 先上传 SQL 到测试服，执行：

```bash
bash scripts/server-ops.sh dev apply-sql sql/002_xxx.sql
```

3. 再上传使用这张新结构的代码，然后 `dev restart` 和 `dev check`。
4. 测试通过后，对正式服重复灌 SQL、上传代码、重启、检查。

不要用重跑 `scripts/setup-postgres-ubuntu.sh` 来改表。角色已经存在时，这个安装脚本不会再改密码。

## 改了 .env

改完保存，执行对应环境的 `restart`，再 `check`。

正式服的 `TOKEN_SECRET` 不要改。一改，手机里旧的登录票据全部失效。

## 宝箱领取怎么验收

仓库里没有现成的 PostgreSQL 测试库，宝箱并发要在测试服看一次：

1. 用一个已经打到宝箱关卡、还没领过的测试号。
2. 快速连点两次领取。
3. 第一次成功。第二次应提示已经领过。
4. 金币、钻石、物品只增加一份，已领列表里这个关卡只出现一次。

## 不要做

- 不要覆盖 `.env` 和 `logs/`。
- 不要在正式服修改 `TOKEN_SECRET`。
- 不要把宝塔探活地址改成 `/ready`。
- 不要对已经有玩家的库重跑安装脚本指望它改密码或改表。
- 导入旧 CloudBase 数据可以对已有库再跑，它会留下库里已有的金币和物品，只补空缺。日常发版不需要跑导入。
