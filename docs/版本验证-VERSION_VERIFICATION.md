# 版本核对

部署或重启后，调用：

```bash
curl https://<该环境域名>/api/version
```

测试服和正式服的域名在 `ops.local.md`。

返回示例：

```json
{
  "code": 0,
  "data": {
    "version": "0.0.12",
    "buildTime": "2026-06-14T16:00:00+08:00",
    "startedAt": "2026-06-14T16:05:00.000Z",
    "revision": "abc123def456",
    "environment": "production",
    "testMode": false,
    "instance": "hostname"
  },
  "msg": "success"
}
```

字段来自 `utils/version.js`：

- `version`：`package.json` 的 `version`
- `buildTime`：环境变量 `BUILD_TIME`（也认 `RELEASE_BUILD_TIME`、`IMAGE_BUILD_TIME`）。没配时等于本次启动时间，不能用来区分「重新拉起」和「新代码」
- `startedAt`：本次进程启动时间
- `revision`：`GIT_COMMIT_SHA`、`COMMIT_SHA`、`RELEASE_VERSION` 或 `IMAGE_TAG`，超过 12 位会截断。没配时是 `null`
- `environment`：`NODE_ENV`，默认 `development`
- `testMode`：`ENABLE_TEST_MODE` 是否为 `true`
- `instance`：主机名

正式服应看到 `testMode: false`。两个环境的 `revision` 只有在发布时写了同一个提交标识时才能互相比较。

`GET /health` 只说明进程在听端口，不包含版本。
