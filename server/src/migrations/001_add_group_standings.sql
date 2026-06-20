-- Add predicted group standings columns to users table
-- These store the predicted final standings for each group as JSON arrays
-- Example: [{"position": 1, "team": "MEXICO"}, {"position": 2, "team": "CANADA"}, ...]

ALTER TABLE users ADD COLUMN IF NOT EXISTS pred_group_a JSON DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pred_group_b JSON DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pred_group_c JSON DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pred_group_d JSON DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pred_group_e JSON DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pred_group_f JSON DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pred_group_g JSON DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pred_group_h JSON DEFAULT NULL;
