use crate::models::*;
use crate::schema::users::dsl::*;
use crate::verify_password;

use diesel::prelude::*;
use log::{info, warn};
use rocket;
use rocket::http::Status;
use rocket::http::{Cookie, Cookies};
use rocket_contrib;
use rocket_contrib::databases::diesel;

pub fn handle() {
    // TODO: web interface

    rocket::ignite()
        .attach(DbConn::fairing())
        .mount("/", routes![login, logout])
        .launch();
}

#[database("stockdb")] // TODO: make configurable
struct DbConn(diesel::PgConnection);

#[get("/user/logout")]
fn logout(mut cookies: Cookies) -> Status {
    cookies.remove_private(Cookie::named("user_id"));
    Status::Ok
}

#[get("/user/login?<username>&<password>")]
fn login(connection: DbConn, mut cookies: Cookies, username: String, password: String) -> Status {
    let u: Result<User, _> = users.filter(name.eq(&username)).first(&*connection);

    match u {
        Ok(u) => {
            if verify_password(&u.hash, &password) {
                info!("Successful login with username '{}'", &username);
                cookies.add_private(Cookie::new("user_id", u.id.to_string()));

                Status::Ok
            } else {
                warn!(
                    "Attempt to login with wrong password for user '{}'",
                    &username
                );

                Status::Unauthorized
            }
        }
        _ => {
            warn!(
                "Attempt to login with non-existing username '{}'",
                &username
            );

            Status::Unauthorized
        }
    }
}
