use crate::models::*;
use crate::schema::*;
use crate::verify_password;
use crate::web::{Config, DbConn};

use diesel::prelude::*;
use log::{info, warn};
use rocket::http::{Cookie, CookieJar, Status};
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

        match id {
            Some(id) => Outcome::Success(UserId(id)),
            None => Outcome::Error((Status::Unauthorized, ())),
        }
    }
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
