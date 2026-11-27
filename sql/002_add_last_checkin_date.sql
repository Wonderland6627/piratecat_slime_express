-- 每日签到防重复领取。
-- DATE 使用服务器业务时区（Asia/Shanghai）计算，NULL 表示从未签到。
ALTER TABLE user_game_infos
  ADD COLUMN IF NOT EXISTS last_checkin_date DATE;

CREATE INDEX IF NOT EXISTS idx_user_game_infos_rank_with_avatar
  ON user_game_infos (progress_level_id DESC)
  WHERE progress_level_id > 0
    AND nick_name <> ''
    AND avatar_url <> '';
