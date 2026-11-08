//! Per-user API keys, the credentials of programs and agents. A key is `rk_<prefix>.<secret>`:
//! the prefix finds the row, the secret is only ever stored as a hash, so the response that
//! creates a key is the one moment anyone can read it.

use crate::schema::api_keys;
use crate::service::DomainError;

use base64::Engine;
use base64::prelude::BASE64_URL_SAFE_NO_PAD;
use chrono::{DateTime, TimeDelta, Utc};
use diesel::deserialize::{self, FromSql, FromSqlRow};
use diesel::expression::AsExpression;
use diesel::pg::{Pg, PgValue};
use diesel::prelude::*;
use diesel::result::{DatabaseErrorKind, Error};
use diesel::serialize::{self, IsNull, Output, ToSql};
use diesel::sql_types::Text;
use log::info;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Write};
use subtle::ConstantTimeEq;

const TOKEN_PREFIX: &str = "rk_";

#[derive(Debug, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, Serialize, Deserialize)]
#[diesel(sql_type = Text)]
#[serde(rename_all = "lowercase")]
pub enum Access {
    /// Requests that only read.
    Read,
    /// Everything the owner may do, which includes reading.
    Write,
}

impl ToSql<Text, Pg> for Access {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        out.write_all(match self {
            Access::Read => b"read",
            Access::Write => b"write",
        })?;
        Ok(IsNull::No)
    }
}

impl FromSql<Text, Pg> for Access {
    fn from_sql(value: PgValue<'_>) -> deserialize::Result<Self> {
        match value.as_bytes() {
            b"read" => Ok(Access::Read),
            b"write" => Ok(Access::Write),
            other => Err(format!(
                "invalid API key access '{}'",
                String::from_utf8_lossy(other)
            )
            .into()),
        }
    }
}

/// A key as its owner sees it: everything but the secret.
#[derive(Debug, Queryable, Selectable, Serialize)]
#[diesel(table_name = api_keys)]
#[serde(rename_all = "camelCase")]
pub struct ApiKey {
    pub id: i32,
    pub name: String,
    pub prefix: String,
    pub access: Access,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewApiKey {
    pub name: String,
    pub access: Access,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatedApiKey {
    pub api_key: ApiKey,
    pub token: String,
}

pub fn list(c: &mut PgConnection, user_id: i32) -> Result<Vec<ApiKey>, DomainError> {
    Ok(api_keys::table
        .filter(api_keys::user_id.eq(user_id))
        .order(api_keys::created_at.desc())
        .select(ApiKey::as_select())
        .load(c)?)
}

pub fn create(
    c: &mut PgConnection,
    user_id: i32,
    key: NewApiKey,
) -> Result<CreatedApiKey, DomainError> {
    let name = key.name.trim();
    if name.is_empty() {
        return Err(DomainError::Invalid("a key needs a name".into()));
    }
    if key.expires_at.is_some_and(|e| e <= Utc::now()) {
        return Err(DomainError::Invalid(
            "the expiry must be in the future".into(),
        ));
    }

    let prefix = format!("{:08x}", u32::from_be_bytes(random_bytes()));
    let secret = BASE64_URL_SAFE_NO_PAD.encode(random_bytes::<32>());

    // ponytail: a prefix collision fails the unique constraint as a 500 and never replaces a key.
    // With 2^32 prefixes that takes tens of thousands of keys; retry here if that ever happens.
    let api_key = diesel::insert_into(api_keys::table)
        .values((
            api_keys::user_id.eq(user_id),
            api_keys::name.eq(name),
            api_keys::prefix.eq(&prefix),
            api_keys::secret_hash.eq(hash(&secret)),
            api_keys::access.eq(key.access),
            api_keys::expires_at.eq(key.expires_at),
        ))
        .returning(ApiKey::as_returning())
        .get_result(c)
        .map_err(|e| match e {
            Error::DatabaseError(DatabaseErrorKind::UniqueViolation, ref info)
                if info.constraint_name() == Some("api_keys_name_unique") =>
            {
                DomainError::Invalid(format!("there already is a key named '{name}'"))
            }
            e => e.into(),
        })?;

    info!(
        "Created API key '{}' ({:?}) for user {}",
        api_key.name, api_key.access, user_id
    );
    Ok(CreatedApiKey {
        api_key,
        token: format!("{TOKEN_PREFIX}{prefix}.{secret}"),
    })
}

pub fn delete(c: &mut PgConnection, user_id: i32, id: i32) -> Result<(), DomainError> {
    let deleted = diesel::delete(
        api_keys::table
            .filter(api_keys::id.eq(id))
            .filter(api_keys::user_id.eq(user_id)),
    )
    .execute(c)?;
    if deleted == 0 {
        return Err(DomainError::NotFound);
    }

    info!("Deleted API key {} of user {}", id, user_id);
    Ok(())
}

/// The owner and access of the key in `token`, or `None` if it is malformed, unknown or expired.
pub fn authenticate(
    c: &mut PgConnection,
    token: &str,
) -> Result<Option<(i32, Access)>, DomainError> {
    let Some((prefix, secret)) = token
        .strip_prefix(TOKEN_PREFIX)
        .and_then(|t| t.split_once('.'))
    else {
        return Ok(None);
    };

    // Hashed and compared even for an unknown prefix, so that the response time does not tell
    // which prefixes exist.
    let presented = hash(secret);
    let row = api_keys::table
        .filter(api_keys::prefix.eq(prefix))
        .select((
            api_keys::id,
            api_keys::user_id,
            api_keys::secret_hash,
            api_keys::access,
            api_keys::expires_at,
        ))
        .first::<(i32, i32, Vec<u8>, Access, Option<DateTime<Utc>>)>(c)
        .optional()?;
    let stored = row.as_ref().map_or(&[0u8; 32][..], |r| &r.2);
    let matches = bool::from(presented.ct_eq(stored));

    let now = Utc::now();
    let Some((id, user_id, _, access, _)) =
        row.filter(|r| matches && r.4.is_none_or(|expiry| expiry > now))
    else {
        return Ok(None);
    };

    // At most once a minute, so that a busy client does not turn every read into a write.
    diesel::update(
        api_keys::table.find(id).filter(
            api_keys::last_used_at
                .is_null()
                .or(api_keys::last_used_at.le(now - TimeDelta::minutes(1))),
        ),
    )
    .set(api_keys::last_used_at.eq(now))
    .execute(c)?;

    Ok(Some((user_id, access)))
}

/// SHA-256 rather than the password hasher, on purpose: a secret is 32 random bytes, so there is
/// no dictionary to walk, and argon2's cost would be paid on every API request.
fn hash(secret: &str) -> Vec<u8> {
    Sha256::digest(secret.as_bytes()).to_vec()
}

fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes = [0u8; N];

    // ponytail: /dev/urandom rather than a rng crate. Unix only, which is where this runs; swap
    // in getrandom if that ever stops being true.
    File::open("/dev/urandom")
        .and_then(|mut f| f.read_exact(&mut bytes))
        .expect("Unable to read from /dev/urandom");

    bytes
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::NewUser;
    use crate::schema::users;

    /// Needs a scratch Postgres database (its contents are rolled back):
    /// `RENDITIER_TEST_DATABASE=postgres://... cargo test -- --ignored`
    #[test]
    #[ignore = "needs a database in RENDITIER_TEST_DATABASE"]
    fn keys_authenticate_until_they_expire_or_are_deleted() {
        let mut connection = crate::test_connection();
        connection.test_transaction::<_, DomainError, _>(|c| {
            let user_id = diesel::insert_into(users::table)
                .values(NewUser {
                    name: "keyholder".into(),
                    full_name: "Key Holder".into(),
                    hash: String::new(),
                })
                .returning(users::id)
                .get_result::<i32>(c)?;
            let new_key = |name: &str, access| NewApiKey {
                name: name.into(),
                access,
                expires_at: None,
            };

            let read = create(c, user_id, new_key(" agent ", Access::Read)).unwrap();
            assert_eq!(read.api_key.name, "agent");
            assert!(
                read.token
                    .starts_with(&format!("rk_{}.", read.api_key.prefix))
            );
            assert_eq!(authenticate(c, &read.token)?, Some((user_id, Access::Read)));

            // A wrong secret, a malformed token or an unknown prefix all look the same.
            let wrong_secret = format!("rk_{}.{}", read.api_key.prefix, "A".repeat(43));
            assert_eq!(authenticate(c, &wrong_secret)?, None);
            assert_eq!(authenticate(c, "rk_nonsense")?, None);
            assert_eq!(authenticate(c, "rk_00000000.abc")?, None);

            // last_used_at moves at most once a minute.
            let last_used = |c: &mut PgConnection| {
                api_keys::table
                    .find(read.api_key.id)
                    .select(api_keys::last_used_at)
                    .first::<Option<DateTime<Utc>>>(c)
            };
            let first_use = last_used(c)?.unwrap();
            authenticate(c, &read.token)?;
            assert_eq!(last_used(c)?, Some(first_use));
            diesel::update(api_keys::table.find(read.api_key.id))
                .set(api_keys::last_used_at.eq(first_use - TimeDelta::minutes(2)))
                .execute(c)?;
            authenticate(c, &read.token)?;
            assert!(last_used(c)?.unwrap() > first_use - TimeDelta::minutes(2));

            // An expired key is refused. The check constraint wants expires_at > created_at, so
            // the key is backdated as a whole.
            let write = create(c, user_id, new_key("lumi", Access::Write)).unwrap();
            assert_eq!(
                authenticate(c, &write.token)?,
                Some((user_id, Access::Write))
            );
            diesel::update(api_keys::table.find(write.api_key.id))
                .set((
                    api_keys::created_at.eq(Utc::now() - TimeDelta::days(2)),
                    api_keys::expires_at.eq(Utc::now() - TimeDelta::days(1)),
                ))
                .execute(c)?;
            assert_eq!(authenticate(c, &write.token)?, None);

            assert_eq!(
                delete(c, user_id + 1, read.api_key.id),
                Err(DomainError::NotFound)
            );
            delete(c, user_id, read.api_key.id)?;
            assert_eq!(authenticate(c, &read.token)?, None);
            assert_eq!(list(c, user_id)?.len(), 1);

            // Last, because the unique violation aborts the surrounding transaction.
            assert!(matches!(
                create(c, user_id, new_key("  ", Access::Write)),
                Err(DomainError::Invalid(_))
            ));
            assert!(matches!(
                create(c, user_id, new_key("lumi", Access::Read)),
                Err(DomainError::Invalid(_))
            ));
            Ok(())
        });
    }
}
