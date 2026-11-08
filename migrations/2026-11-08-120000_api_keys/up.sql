CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (name ~ '[^[:space:]]'),
    prefix TEXT NOT NULL UNIQUE CHECK (prefix ~ '^[0-9a-f]{8}$'),
    secret_hash BYTEA NOT NULL CHECK (octet_length(secret_hash) = 32),
    access TEXT NOT NULL CHECK (access IN ('read', 'write')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    CONSTRAINT api_keys_name_unique UNIQUE (user_id, name),
    CHECK (expires_at > created_at)
);

ALTER TABLE users
DROP COLUMN api_token_hash;
