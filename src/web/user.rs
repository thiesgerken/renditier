use crate::models::*;
use crate::schema::*;
use crate::service::api_keys::{self, Access};
use crate::verify_password;
use crate::web::{Config, DbConn};

use diesel::prelude::*;
use log::{debug, error, info, warn};
use rocket::http::{Cookie, CookieJar, Method, Status};
use rocket::outcome::try_outcome;
use rocket::request::{FromRequest, Outcome};
use rocket::serde::json::Json;
use rocket::{Request, State};
use rocket_sync_db_pools::diesel;
use serde::{Deserialize, Serialize};
use std::ops::Deref;

impl Deref for UserId {
    type Target = i32;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// The user behind a session or an API key. A read key only gets this far on a request that
/// cannot change anything, so the handlers need not care how the caller authenticated.
pub struct UserId(i32);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for UserId {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let (id, access) = try_outcome!(caller(request).await);

        if access == Access::Read && !matches!(request.method(), Method::Get | Method::Head) {
            warn!(
                "Attempt to use a read-only API key of user {} on a {} request",
                id,
                request.method()
            );

            return Outcome::Error((Status::Forbidden, ()));
        }

        Outcome::Success(UserId(id))
    }
}

/// The user behind a session (password login or Remote-User SSO), never an API key. For what
/// must not be in reach of a leaked key, like managing keys.
pub struct SessionUserId(i32);

impl Deref for SessionUserId {
    type Target = i32;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for SessionUserId {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        match session_user_id(request) {
            Some(id) => Outcome::Success(SessionUserId(id)),
            None => Outcome::Error((Status::Unauthorized, ())),
        }
    }
}

fn session_user_id(request: &Request<'_>) -> Option<i32> {
    request
        .cookies()
        .get_private("user_id")
        .and_then(|c| c.value().parse().ok())
}

/// Who is calling, and with which access. A session may do everything its user may.
async fn caller(request: &Request<'_>) -> Outcome<(i32, Access), ()> {
    match session_user_id(request) {
        Some(id) => Outcome::Success((id, Access::Write)),
        None => api_key_caller(request).await,
    }
}

/// The owner and access of the API key in the `Authorization` header, ignoring any session. For
/// routes that only machines use, where a session cookie a browser sends along cross-site must
/// not count.
pub(crate) async fn api_key_caller(request: &Request<'_>) -> Outcome<(i32, Access), ()> {
    let Some(token) = bearer_token(request) else {
        return Outcome::Error((Status::Unauthorized, ()));
    };
    let Some(connection) = request.guard::<DbConn>().await.succeeded() else {
        return Outcome::Error((Status::ServiceUnavailable, ()));
    };

    match connection
        .run(move |c| api_keys::authenticate(c, &token))
        .await
    {
        Ok(Some((id, access))) => {
            // One line per API request at info would drown the log; the failure is the
            // interesting one.
            debug!("Successful authentication with an API key of user {}", id);
            Outcome::Success((id, access))
        }
        Ok(None) => {
            warn!("Attempt to authenticate with an unknown or expired API key");
            Outcome::Error((Status::Unauthorized, ()))
        }
        Err(e) => {
            error!("Unable to look up an API key: {}", e);
            Outcome::Error((Status::InternalServerError, ()))
        }
    }
}

fn bearer_token(request: &Request<'_>) -> Option<String> {
    let (scheme, token) = request
        .headers()
        .get_one("Authorization")?
        .split_once(' ')?;

    // The scheme is case-insensitive per RFC 7235, and refusing `bearer` would look from the
    // outside exactly like a rejected token.
    if !scheme.eq_ignore_ascii_case("bearer") {
        return None;
    }

    Some(token.trim().to_owned()).filter(|t| !t.is_empty())
}

pub struct OptionalUserId(Option<UserId>);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for OptionalUserId {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        match UserId::from_request(request).await {
            Outcome::Success(id) => Outcome::Success(OptionalUserId(Some(id))),
            _ => Outcome::Success(OptionalUserId(None)),
        }
    }
}

pub struct TrustedHeaderSSO {
    user_name: Option<String>,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for TrustedHeaderSSO {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let user_name = request.headers().get_one("Remote-User");
        match user_name {
            Some(user_name) => Outcome::Success(TrustedHeaderSSO {
                user_name: Some(user_name.to_owned()),
            }),
            None => Outcome::Success(TrustedHeaderSSO { user_name: None }),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    id: Option<i32>,
    name: Option<String>,
    full_name: Option<String>,
    redirect: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginData {
    user_name: String,
    password: String,
}

impl UserInfo {
    pub fn new(user: User) -> Self {
        Self {
            id: Some(user.id),
            name: Some(user.name),
            full_name: Some(user.full_name),
            redirect: None,
        }
    }
}

#[get("/user")]
pub async fn info(
    config: &State<Config>,
    uid: OptionalUserId,
    trusted_header: TrustedHeaderSSO,
    cookies: &CookieJar<'_>,
    connection: DbConn,
) -> (Status, Option<Json<UserInfo>>) {
    if let Some(uid) = uid.0 {
        let info = connection
            .run(move |c| {
                users::table
                    .find(*uid)
                    .first(c)
                    .map(|u| Json(UserInfo::new(u)))
                    .ok()
            })
            .await;
        if info.is_some() {
            return (Status::Ok, info);
        } else {
            return (Status::Forbidden, None);
        }
    }

    if config.trusted_header_authentication
        && let Some(user_name) = trusted_header.user_name
    {
        use crate::schema::users::dsl::*;
        let uname = user_name.clone();
        let u: Result<User, _> = connection
            .run(|c| users.filter(name.eq(uname)).first(c))
            .await;

        if let Ok(u) = u {
            info!(
                "Successful login with username from trusted header: '{}'",
                user_name
            );
            cookies.add_private(Cookie::new("user_id", u.id.to_string()));

            return (Status::Ok, Some(Json(UserInfo::new(u))));
        } else {
            warn!(
                "Attempt to login with non-existing username via trusted header: '{}'; ignoring.",
                user_name
            );
        }
    }

    (
        Status::Unauthorized,
        Some(Json(UserInfo {
            id: None,
            name: None,
            full_name: None,
            redirect: config.authentication_redirect.clone(),
        })),
    )
}

#[get("/user/logout")]
pub fn logout(cookies: &CookieJar<'_>) -> Status {
    cookies.remove_private(Cookie::build("user_id"));
    Status::Ok
}

#[post("/user/login", data = "<login>")]
pub async fn login(
    connection: DbConn,
    cookies: &CookieJar<'_>,
    login: Json<LoginData>,
) -> Result<Json<UserInfo>, Status> {
    use crate::schema::users::dsl::*;
    let user_name = login.user_name.clone();
    let u: Result<User, _> = connection
        .run(|c| users.filter(name.eq(user_name)).first(c))
        .await;

    match u {
        Ok(u) => {
            if verify_password(&login.password, &u.hash) {
                info!("Successful login with username '{}'", login.user_name);
                cookies.add_private(Cookie::new("user_id", u.id.to_string()));

                Ok(Json(UserInfo::new(u)))
            } else {
                warn!(
                    "Attempt to login with wrong password for user '{}'",
                    login.user_name
                );

                Err(Status::Unauthorized)
            }
        }
        _ => {
            warn!(
                "Attempt to login with non-existing username '{}'",
                login.user_name
            );

            Err(Status::Unauthorized)
        }
    }
}
