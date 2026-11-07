CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auth TEXT NOT NULL,
  p256dh TEXT NOT NULL, 
  created TIMESTAMPTZ NOT NULL,
  last_contact TIMESTAMPTZ NOT NULL,
  last_notification TIMESTAMPTZ 
)
    