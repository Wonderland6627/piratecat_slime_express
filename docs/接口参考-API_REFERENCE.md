# API 参考文档（当前实现）

## 基础信息

- Base URL（业务接口）：`/api/minigame`
- 认证方式：Bearer Token
- 请求方法：业务接口统一 `POST`

---

## 响应规范

业务接口统一返回：

```json
{
  "code": 0,
  "data": {},
  "msg": "success"
}
```

错误码：

- `0` 成功
- `-1` 通用错误
- `-2` 未授权（HTTP 401）
- `-3` 未找到（HTTP 404）
- `-4` 参数校验失败（HTTP 400）
- `-5` 资源不足

---

## 公开接口（无需 Token）

### `POST /api/minigame/getCode2Session`

通过平台 code 获取会话信息并签发 JWT。

请求：

```json
{
  "code": "string",
  "platform": "wechat"
}
```

说明：

- `platform` 会转成小写。`wechat` 和 `editor` 可用
- `douyin`、`bilibili` 会直接返回未实现
- `editor` 仅在 `ENABLE_TEST_MODE=true` 时可用。`code` 当作测试 openid；不传则用 `TEST_OPENID`，再没有就是 `default`

响应 `data`：

```json
{
  "openid": "string",
  "platform": "wechat",
  "unionid": null,
  "session_key": "string",
  "token": "jwt-token",
  "appid": "wx-appid-or-null"
}
```

---

## 鉴权接口（需要 Token）

> Header：`Authorization: Bearer <token>`

### 1) 用户上下文

#### `POST /api/minigame/getUserWXContext`

响应 `data`：

```json
{
  "event": {},
  "openid": "string",
  "appid": "string-or-null",
  "unionid": null
}
```

### 2) 用户信息

#### `POST /api/minigame/getUserGameInfoV2`

没有档案时会创建。新建时 `msg` 为 `no result found, created empty info`，已有档案时为 `get user game info success`。

响应 `data`（示例）：

```json
{
  "_id": "doc-id",
  "openID": "user-openid",
  "progressLevelID": 0,
  "nickName": "",
  "avatarUrl": "",
  "resources": { "1": 0, "2": 150, "3": 0 },
  "goods": {},
  "claimedLevelChests": []
}
```

#### `POST /api/minigame/setUserGameInfoV2`

更新用户信息（会过滤请求中的 `openid/openID`，以鉴权用户为准）。

请求示例：

```json
{
  "progressLevelID": 10,
  "nickName": "玩家A",
  "avatarUrl": "https://example.com/a.png"
}
```

### 3) 排行榜与关卡

#### `POST /api/minigame/getUserRankListV2`

请求示例：

```json
{ "limit": 100 }
```

只包含 `progressLevelID > 0` 且 `nickName` 非空的用户，按 `progressLevelID` 降序。当前用户不在列表里、但进度大于 0 时，可能被补进列表。默认 `limit` 为 100。

#### `POST /api/minigame/getLevelsConfigV2`

请求示例（可选）：

```json
{ "levelId": "level-doc-id" }
```

返回 CloudBase `Levels` 集合中的文档。不传 `levelId` 时使用 `config/constants.js` 的 `DEFAULTS.DEFAULT_LEVEL_ID`。

### 4) 资源系统

#### `POST /api/minigame/updateResource`

请求：

```json
{
  "resourceType": 1,
  "change": 100,
  "source": "level_reward"
}
```

响应 `data`：

```json
{
  "resourceType": 1,
  "value": 600,
  "change": 100
}
```

#### `POST /api/minigame/getResources`

响应 `data`：

```json
{
  "resources": { "1": 500, "2": 120, "3": 0 }
}
```

### 5) 奖励结算

#### `POST /api/minigame/claimLevelReward`

请求：

```json
{
  "levelId": 12,
  "watchedAd": false
}
```

响应 `data`：

```json
{
  "rewards": [
    { "itemType": 1, "itemId": 1, "amount": 120, "source": "level_reward" }
  ],
  "isFirstClear": true
}
```

#### `POST /api/minigame/claimDailyCheckin`

请求：`{}`

响应 `data`：

```json
{
  "rewards": [],
  "resources": { "1": 520, "2": 120, "3": 0 },
  "goods": {}
}
```

#### `POST /api/minigame/claimAdsGiftPack`

`rewardId` 必须是数字，并且在 Luban `TbGlobalConfig.ad_reward_pack_ids` 里。

```json
{ "rewardId": 1001 }
```

响应 `data`：`rewards`、`resources`、`goods`。

#### `POST /api/minigame/debugSetUserGameInfo`

仅 `ENABLE_TEST_MODE=true` 时可调用，请求体与 `setUserGameInfoV2` 相同，按 Token 里的用户覆盖档案。

#### `POST /api/minigame/claimLevelChest`

请求：

```json
{
  "chestLevelId": 9
}
```

响应 `data`：

```json
{
  "rewards": [],
  "claimedLevelChests": [3, 6, 9],
  "resources": { "1": 560, "2": 120, "3": 0 },
  "goods": { "1001": 1 }
}
```

---

## 资源与来源枚举

### ResourceType

- `1` Coin
- `2` Energy
- `3` Diamond

### ResourceSource

- `daily_checkin`
- `level_reward`
- `first_clear`
- `star_reward`
- `daily_task`
- `achievement`
- `daily_login`
- `ad_reward`
- `chest_reward`
- `level_consume`

---

## 其他接口

这些接口位于 `routes/index.js`，不属于 `minigame` 路由组：

- `GET /api/version`
- `POST /api/time`
- `GET /health`
