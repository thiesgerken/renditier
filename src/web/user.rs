use crate::models::*;
use crate::schema::*;
use crate::verify_password;
use crate::web::{Config, DbConn};

use diesel::prelude::*;
use log::{info, warn};
use rocket::http::{Cookie, CookieJar, Status};
use rocket::request::{FromRequest, Outcome};
use rocket::{Request, State};
use rocket_contrib::databases::diesel;
use rocket_contrib::json::Json;
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
impl<'a, 'r> FromRequest<'a, 'r> for UserId {
    type Error = ();

    async fn from_request(request: &'a Request<'r>) -> Outcome<Self, Self::Error> {
        let id = request
            .cookies()
            .get_private("user_id")
            .and_then(|c| c.value().parse().ok());

        match id {
            Some(id) => Outcome::Success(UserId(id)),
            None => Outcome::Failure((Status::Unauthorized, ())),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    id: i32,
    name: String,
    full_name: String,
    application_server_key: String,
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
            id: user.id,
            name: user.name,
            full_name: user.full_name,
            application_server_key,
        }
    }
}

#[get("/user")]
pub async fn info(
    config: State<'_, Config>,
    uid: UserId,
    connection: DbConn,
) -> Option<Json<UserInfo>> {
    let key = config.application_server_key.clone();

    connection
        .run(move |c| {
            users::table
                .find(*uid)
                .first(c)
                .map(|u| Json(UserInfo::new(u, key)))
                .ok()
        })
        .await
}

#[get("/user/logout")]
pub fn logout(cookies: &CookieJar) -> Status {
    cookies.remove_private(Cookie::named("user_id"));
    Status::Ok
}

#[post("/user/login", data = "<login>")]
pub async fn login(
    config: State<'_, Config>,
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
