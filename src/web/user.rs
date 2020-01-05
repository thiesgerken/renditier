use crate::models::*;
use crate::schema::*;
use crate::verify_password;
use crate::web::DbConn;

use diesel::prelude::*;
use log::{info, warn};
use rocket::http::{Cookie, Cookies, Status};
use rocket::request::{FromRequest, Outcome};
use rocket::Request;
use rocket_contrib::databases::diesel;
use rocket_contrib::json::Json;
use serde::Serialize;
use std::ops::Deref;

impl Deref for UserId {
  type Target = i32;

  fn deref(&self) -> &Self::Target {
    &self.0
  }
}

pub struct UserId(i32);

impl<'a, 'r> FromRequest<'a, 'r> for UserId {
  type Error = ();

  fn from_request(request: &'a Request<'r>) -> Outcome<Self, Self::Error> {
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
pub struct UserInfo {
  id: i32,
  name: String,
  full_name: String,
}

impl UserInfo {
  pub fn new(user: User) -> Self {
    Self {
      id: user.id,
      name: user.name,
      full_name: user.full_name,
    }
  }
}

#[get("/user/info")]
pub fn info(uid: UserId, connection: DbConn) -> Option<Json<UserInfo>> {
  users::table
    .find(*uid)
    .first(&*connection)
    .map(|u| Json(UserInfo::new(u)))
    .ok()
}

#[get("/user/logout")]
pub fn logout(mut cookies: Cookies) -> Status {
  cookies.remove_private(Cookie::named("user_id"));
  Status::Ok
}

#[get("/user/login?<username>&<password>")]
pub fn login(
  connection: DbConn,
  mut cookies: Cookies,
  username: String,
  password: String,
) -> Result<Json<UserInfo>, Status> {
  use crate::schema::users::dsl::*;
  let u: Result<User, _> = users.filter(name.eq(&username)).first(&*connection);

  match u {
    Ok(u) => {
      if verify_password(&password, &u.hash) {
        info!("Successful login with username '{}'", &username);
        cookies.add_private(Cookie::new("user_id", u.id.to_string()));

        Ok(Json(UserInfo::new(u)))
      } else {
        warn!(
          "Attempt to login with wrong password for user '{}'",
          &username
        );

        Err(Status::Unauthorized)
      }
    }
    _ => {
      warn!(
        "Attempt to login with non-existing username '{}'",
        &username
      );

      Err(Status::Unauthorized)
    }
  }
}
