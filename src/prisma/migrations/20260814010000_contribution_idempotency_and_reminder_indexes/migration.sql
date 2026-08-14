-- Prevent duplicate bank/provider events while allowing multiple manual contributions (NULL).
CREATE UNIQUE INDEX "contributions_external_reference_key"
ON "contributions"("external_reference");

CREATE INDEX "contributions_goal_id_date_idx"
ON "contributions"("goal_id", "date" DESC);

CREATE INDEX "notification_logs_user_id_type_created_at_idx"
ON "notification_logs"("user_id", "type", "created_at" DESC);
