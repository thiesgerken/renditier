use diesel::prelude::*;
use rocket;
use rocket_contrib;
use rocket_contrib::databases::diesel;

pub fn handle() {
  // TODO: web interface

  rocket::ignite()
    .attach(DbConn::fairing())
    .mount("/", routes![get_logs])
    .launch();
}

#[database("stockdb")] // TODO: make configurable
struct DbConn(diesel::PgConnection);

#[get("/logs/<id>")]
fn get_logs(conn: DbConn, id: usize) -> String {
  // logs::filter(id.eq(log_id)).load(&*conn)
  format!("{}", id)
}
