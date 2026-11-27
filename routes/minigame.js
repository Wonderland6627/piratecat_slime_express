// 小游戏API路由
const express = require('express');
const router = express.Router();

// 中间件
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');
const { validateCode } = require('../middlewares/validator');
const { testModeMiddleware } = require('../middlewares/testMode');
const { loginLimiter, userActionLimiter } = require('../middlewares/rateLimiter');
const { asyncHandler } = require('../middlewares/asyncHandler');

// 控制器
const minigameController = require('../controllers/minigameController');
const resourceController = require('../controllers/resourceController');
const levelRewardController = require('../controllers/levelRewardController');
const dailyCheckinController = require('../controllers/dailyCheckinController');
const levelChestController = require('../controllers/levelChestController');
const adsGiftPackController = require('../controllers/adsGiftPackController');

/**
 * POST /api/minigame/getCode2Session
 */
router.post('/getCode2Session', 
  loginLimiter,
  validateCode,
  asyncHandler(minigameController.getCode2Session)
);

/**
 * POST /api/minigame/getUserWXContext
 */
router.post('/getUserWXContext',
  authMiddleware,
  asyncHandler(minigameController.getUserWXContext)
);

/**
 * POST /api/minigame/getUserGameInfoV2
 */
router.post('/getUserGameInfoV2',
  authMiddleware,
  asyncHandler(minigameController.getUserGameInfo)
);

/**
 * POST /api/minigame/setUserGameInfoV2
 */
router.post('/setUserGameInfoV2',
  authMiddleware,
  userActionLimiter,
  asyncHandler(minigameController.setUserGameInfo)
);

/**
 * POST /api/minigame/getUserRankListV2
 */
router.post('/getUserRankListV2',
  authMiddleware,
  asyncHandler(minigameController.getUserRankList)
);

/**
 * POST /api/minigame/getLevelsConfigV2
 * Deprecated: levels are loaded from local client assets. Kept for compatibility (returns 404).
 */
router.post('/getLevelsConfigV2',
  authMiddleware,
  asyncHandler(minigameController.getLevelsConfig)
);

/**
 * POST /api/minigame/updateResource
 * Body: { resourceType: number, change: number, source: string }
 */
router.post('/updateResource',
  authMiddleware,
  userActionLimiter,
  asyncHandler(resourceController.updateResource)
);

/**
 * POST /api/minigame/getResources
 */
router.post('/getResources',
  authMiddleware,
  asyncHandler(resourceController.getResources)
);

/**
 * POST /api/minigame/claimLevelReward
 * Body: { levelId: number, watchedAd?: boolean }
 */
router.post('/claimLevelReward',
  authMiddleware,
  userActionLimiter,
  asyncHandler(levelRewardController.claimLevelReward)
);

/**
 * POST /api/minigame/claimDailyCheckin
 */
router.post('/claimDailyCheckin',
  authMiddleware,
  userActionLimiter,
  asyncHandler(dailyCheckinController.claimDailyCheckin)
);

/**
 * POST /api/minigame/claimLevelChest
 * Body: { chestLevelId: number }
 */
router.post('/claimLevelChest',
  authMiddleware,
  userActionLimiter,
  asyncHandler(levelChestController.claimLevelChest)
);

/**
 * POST /api/minigame/claimAdsGiftPack
 * Body: { rewardId: number }
 */
router.post('/claimAdsGiftPack',
  authMiddleware,
  userActionLimiter,
  asyncHandler(adsGiftPackController.claimAdsGiftPack)
);

/**
 * POST /api/minigame/debugSetUserGameInfo
 * 仅测试模式可用，覆盖用户游戏信息
 */
router.post('/debugSetUserGameInfo',
  authMiddleware,
  testModeMiddleware,
  userActionLimiter,
  asyncHandler(minigameController.debugSetUserGameInfo)
);

module.exports = router;
