-- Partial index: enforces email uniqueness only for non-deleted (active) users,
-- allowing tombstoned users to share an email with a new account.
CREATE INDEX IF NOT EXISTS user_active_email ON "User" ("email") WHERE "deletedAt" IS NULL;
