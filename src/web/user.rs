use crate::models::*;
use crate::schema::*;
use crate::web::{Config, DbConn};
use crate::{hash_token, verify_password};

use diesel::prelude::*;
use log::{debug, info, warn};
use rocket::http::{Cookie, CookieJar, Method, Status};
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

pub struct UserId(i32);

#[rocket::async_trait]
impl<'r> FromRequest<'r> for UserId {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        let id = request
            .cookies()
            .get_private("user_id")
            .and_then(|c| c.value().parse().ok());

        if let Some(id) = id {
            return Outcome::Success(UserId(id));
        }

        // A bearer token is the way in for something that is not a browser, so it is only looked
        // at when no session cookie answered first. It reads and never writes: a token carries no
        // second factor and cannot be asked to confirm anything, so a leaked one must not be able
        // to delete an account. Widening this later is easy; narrowing it after tokens are in use
        // is not.
        let id = match bearer_token(request) {
            Some(_) if request.method() != Method::Get => {
                warn!(
                    "Attempt to use an API token on a {} request; tokens authenticate GET only",
                    request.method()
                );

                None
            }
            Some(token) => resolve_token(request, token).await,
            None => None,
        };

        match id {
            Some(id) => Outcome::Success(UserId(id)),
            None => Outcome::Error((Status::Unauthorized, ())),
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

async fn resolve_token(request: &Request<'_>, token: String) -> Option<i32> {
    let connection = request.guard::<DbConn>().await.succeeded()?;
    let presented = hash_token(&token);

    let id = connection
        .run(move |c| {
            users::table
                .filter(users::api_token_hash.eq(presented))
                .select(users::id)
                .first::<i32>(c)
                .ok()
        })
        .await;

    match id {
        // One line per API request at info would drown the log; the failure is the interesting one.
        Some(id) => debug!("Successful authentication with an API token of user {}", id),
        None => warn!("Attempt to authenticate with an unknown API token"),
    }

    id
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
    application_server_key: Option<String>,
    redirect: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginData {
    user_name: String,
    password: String,
}

impl UserInfo {
    pub fn new(user: User, application_server_key: String) -> Self {
        Self {
            id: Some(user.id),
            name: Some(user.name),
            full_name: Some(user.full_name),
            application_server_key: Some(application_server_key),
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
        let key = config.application_server_key.clone();

        let info = connection
            .run(move |c| {
                users::table
                    .find(*uid)
                    .first(c)
                    .map(|u| Json(UserInfo::new(u, key)))
                    .ok()
            })
            .await;
        if info.is_some() {
            return (Status::Ok, info);
        } else {
            return (Status::Forbidden, None);
        }
    }

    if config.trusted_header_authentication {
        if let Some(user_name) = trusted_header.user_name {
            use crate::schema::users::dsl::*;
            let uname = user_name.clone();
            let u: Result<User, _> = connection
                .run(|c| users.filter(name.eq(uname)).first(c))
                .await;

            if let Ok(u) = u {
                info!(
                    "Successful login with username from trusted header: '{}'",
                    &user_name
                );
                cookies.add_private(Cookie::new("user_id", u.id.to_string()));

                return (
                    Status::Ok,
                    Some(Json(UserInfo::new(
                        u,
                        config.application_server_key.clone(),
                    ))),
                );
            } else {
                warn!(
                "Attempt to login with non-existing username via trusted header: '{}'; ignoring.",
                &user_name
            );
            }
        }
    }

    (
        Status::Unauthorized,
        Some(Json(UserInfo {
            id: None,
            name: None,
            full_name: None,
            application_server_key: None,
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
    config: &State<Config>,
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
                info!("Successful login with username '{}'", &login.user_name);
                cookies.add_private(Cookie::new("user_id", u.id.to_string()));

                Ok(Json(UserInfo::new(
                    u,
                    config.application_server_key.clone(),
                )))
            } else {
                warn!(
                    "Attempt to login with wrong password for user '{}'",
                    &login.user_name
                );

                Err(Status::Unauthorized)
            }
        }
        _ => {
            warn!(
                "Attempt to login with non-existing username '{}'",
                &login.user_name
            );

            Err(Status::Unauthorized)
        }
    }
}
