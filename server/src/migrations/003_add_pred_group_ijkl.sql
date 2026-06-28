-- Add missing pred_group columns for groups I, J, K, L
ALTER TABLE users
ADD COLUMN pred_group_i JSON NULL AFTER pred_group_h,
ADD COLUMN pred_group_j JSON NULL AFTER pred_group_i,
ADD COLUMN pred_group_k JSON NULL AFTER pred_group_j,
ADD COLUMN pred_group_l JSON NULL AFTER pred_group_k;
