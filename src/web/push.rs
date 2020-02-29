use crate::web::user::UserId;
use crate::web::DbConn;

use log::warn;
use rocket::http::Status;
use rocket_contrib::json::Json;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub struct PushSubscription {
    endpoint: String,
    keys: PushSubscriptionKeys,
}

#[derive(Deserialize, Debug)]
pub struct PushSubscriptionKeys {
    auth: String,
    p256dh: String,
}

#[post("/push/subscribe", data = "<subscription>")]
pub fn subscribe(uid: UserId, connection: DbConn, subscription: Json<PushSubscription>) -> Status {
    warn!("subscribe: {:?}", subscription);
    Status::Ok
}

#[post("/push/unsubscribe", data = "<subscription>")]
pub fn unsubscribe(
    uid: UserId,
    connection: DbConn,
    subscription: Json<PushSubscription>,
) -> Status {
    warn!("unsubscribe: {:?}", subscription);
    Status::Ok
}
