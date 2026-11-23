#!/usr/bin/env bash
# 测试服 / 正式服的检查、重启、灌 SQL、备份。
# 用法见 docs/后端操作手册-OPS_PLAYBOOK.md
set -euo pipefail

usage() {
  cat <<'EOF'
用法（在云服上执行）:
  bash scripts/ops/server-ops.sh dev check
  bash scripts/ops/server-ops.sh dev restart
  bash scripts/ops/server-ops.sh dev apply-sql sql/002_xxx.sql
  bash scripts/ops/server-ops.sh prod backup

环境只能写 dev 或 prod。
check    看进程、数据库和版本
restart  重启这个目录对应的 Node 进程
apply-sql  把 sql 文件灌进这个环境的库
backup   只允许 prod，调用 scripts/postgres/backup-postgres.sh

本机也可以:
  scripts\ops\server-ops.bat dev check
EOF
}

print_manual_restart() {
  echo
  echo "[需要你手动点一下] 没有找到这个目录对应的 pm2 进程。"
  echo "打开宝塔 → 网站 → Node项目 → 找到下面这个目录的项目 → 点重启。"
  echo "目录: ${APP_DIR}"
  echo "重启后执行: bash scripts/ops/server-ops.sh ${ENV_NAME} check"
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

ENV_NAME="$1"
CMD="$2"
SQL_ARG="${3:-}"

case "${ENV_NAME}" in
  dev)
    APP_DIR="/www/apps/slime-express/piratecat_slime_express_dev"
    DB_NAME="slime_dev"
    BASE_URL="https://dev.slime.piratecat.top"
    ;;
  prod)
    APP_DIR="/www/apps/slime-express/piratecat_slime_express"
    DB_NAME="slime_prod"
    BASE_URL="https://slime.piratecat.top"
    ;;
  *)
    usage
    exit 1
    ;;
esac

show_http() {
  local path="$1"
  echo
  echo "GET ${BASE_URL}${path}"
  curl -sS -w "\nHTTP %{http_code}\n" "${BASE_URL}${path}" || echo "[FAIL] 连不上 ${BASE_URL}${path}"
}

cmd_check() {
  echo "环境: ${ENV_NAME}"
  echo "目录: ${APP_DIR}"
  echo "数据库: ${DB_NAME}"
  show_http "/health"
  show_http "/ready"
  show_http "/api/version"

  echo
  echo "---- 最近日志 ----"
  if [[ ! -d "${APP_DIR}/logs" ]]; then
    echo "没有日志目录: ${APP_DIR}/logs"
    return 0
  fi

  local latest
  latest="$(find "${APP_DIR}/logs" -type f -name '*.log' -printf '%T@ %p\n' | sort -nr | head -n 1 | cut -d' ' -f2- || true)"
  if [[ -z "${latest}" ]]; then
    echo "还没有日志文件"
    return 0
  fi

  echo "日志文件: ${latest}"
  grep -E 'Connected successfully|Luban config loaded|Warm-up failed|Server listening' "${latest}" | tail -n 20 || echo "这段日志里还没有数据库或配置表的启动记录"
}

cmd_restart() {
  if ! command -v pm2 >/dev/null 2>&1; then
    print_manual_restart
    exit 2
  fi
  if ! command -v node >/dev/null 2>&1; then
    print_manual_restart
    exit 2
  fi

  local ids code
  set +e
  ids="$(node -e '
    const { execSync } = require("child_process");
    const dir = process.argv[1];
    let list;
    try {
      list = JSON.parse(execSync("pm2 jlist", { encoding: "utf8" }));
    } catch (error) {
      process.stderr.write(String(error.stderr || error.message || error));
      process.exit(3);
    }
    const hits = list.filter((proc) => {
      const env = proc.pm2_env || {};
      const cwd = env.pm_cwd || "";
      const execPath = env.pm_exec_path || "";
      return cwd === dir || execPath.startsWith(dir + "/") || execPath.startsWith(dir + "\\");
    });
    if (hits.length === 0) process.exit(2);
    process.stdout.write(hits.map((proc) => String(proc.pm_id)).join(" "));
  ' "${APP_DIR}")"
  code=$?
  set -e

  if [[ "${code}" -eq 2 || -z "${ids}" ]]; then
    print_manual_restart
    exit 2
  fi
  if [[ "${code}" -ne 0 ]]; then
    echo "[ERROR] 读取 pm2 进程列表失败"
    exit 1
  fi

  for id in ${ids}; do
    echo "重启 pm2 进程 ${id} （目录 ${APP_DIR}）"
    pm2 restart "${id}" --update-env
  done

  echo
  echo "等 2 秒后检查..."
  sleep 2
  cmd_check
}

cmd_apply_sql() {
  if [[ -z "${SQL_ARG}" ]]; then
    echo "用法: bash scripts/ops/server-ops.sh ${ENV_NAME} apply-sql sql/002_xxx.sql"
    exit 1
  fi

  local sql_file="${SQL_ARG}"
  if [[ "${sql_file}" != /* ]]; then
    sql_file="${APP_DIR}/${sql_file}"
  fi
  if [[ ! -f "${sql_file}" ]]; then
    echo "[ERROR] 找不到 SQL 文件: ${sql_file}"
    exit 1
  fi

  local base
  base="$(basename "${sql_file}")"
  if [[ "${base}" == "001_init_schema.sql" && "${CONFIRM_INIT:-}" != "yes" ]]; then
    echo "[ERROR] 001_init_schema.sql 是第一次建表用的，不能拿来当日常更新。"
    echo "确定要执行时，在命令前面加上 CONFIRM_INIT=yes"
    exit 1
  fi

  echo "灌入 ${sql_file} -> 数据库 ${DB_NAME}"
  sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 -f "${sql_file}"
  echo "[OK] SQL 已灌入 ${DB_NAME}"
  echo "如果这次还改了 js 代码，接着执行: bash scripts/ops/server-ops.sh ${ENV_NAME} restart"
}

cmd_backup() {
  if [[ "${ENV_NAME}" != "prod" ]]; then
    echo "[ERROR] backup 只允许对 prod 执行，避免把测试库当成正式备份。"
    exit 1
  fi
  bash "${APP_DIR}/scripts/postgres/backup-postgres.sh"
}

case "${CMD}" in
  check) cmd_check ;;
  restart) cmd_restart ;;
  apply-sql) cmd_apply_sql ;;
  backup) cmd_backup ;;
  *)
    usage
    exit 1
    ;;
esac
