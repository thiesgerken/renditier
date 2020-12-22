use crate::models::*;
use crate::schema::push_subscriptions::dsl::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use chrono::Utc;
use diesel::prelude::*;
use log::{info, warn};
use rocket::http::Status;
use rocket_contrib::json::Json;
use web_push::SubscriptionInfo;

#[post("/push/subscribe", data = "<subscription>")]
pub async fn subscribe(
    uid: UserId,
    connection: DbConn,
    subscription: Json<SubscriptionInfo>,
) -> Option<Status> {
    connection
        .run(move |c| {
            let existing = crate::schema::push_subscriptions::table
                .find(&subscription.endpoint)
                .load::<PushSubscription>(c)
                .ok()?
                .into_iter()
                .next();

            if let Some(sub) = existing {
                if sub.user_id != *uid {
                    warn!(
                        "Attempt to update push subscription {} of uid={} by uid={}",
                        sub.endpoint, sub.user_id, *uid
                    );
                    return None;
                }

                diesel::update(push_subscriptions.find(&subscription.endpoint))
                    .set((
                        auth.eq(&subscription.keys.auth),
                        p256dh.eq(&subscription.keys.p256dh),
                        last_contact.eq(Utc::now()),
                    ))
                    .execute(c)
                    .ok()?;

                info!("Updated existing push subscription {}", sub.endpoint);
            } else {
                let sub = PushSubscription {
                    user_id: *uid,
                    auth: subscription.keys.auth.clone(),
                    p256dh: subscription.keys.p256dh.clone(),
                    endpoint: subscription.endpoint.clone(),
                    created: Utc::now(),
                    last_contact: Utc::now(),
                    last_notification: None,
                };

                diesel::insert_into(crate::schema::push_subscriptions::table)
                    .values(&sub)
                    .execute(c)
                    .ok();

                info!("Inserted new push subscription {}", sub.endpoint);
            }

            Some(Status::Ok)
        })
        .await
}

#[post("/push/unsubscribe", data = "<subscription>")]
pub async fn unsubscribe(
    uid: UserId,
    connection: DbConn,
    subscription: Json<SubscriptionInfo>,
) -> Option<Status> {
    connection
        .run(move |c| {
            let sub = crate::schema::push_subscriptions::table
                .find(&subscription.endpoint)
                .load::<PushSubscription>(c)
                .ok()?
                .into_iter()
                .next()?;

            if sub.user_id != *uid {
                warn!(
                    "Attempt to remove push subscription {} of uid={} by uid={}",
                    sub.endpoint, sub.user_id, *uid
                );

                return None;
            }

            diesel::delete(push_subscriptions.find(&subscription.endpoint))
                .execute(c)
                .ok()?;

            info!("Removed push subscription {}", sub.endpoint);
            Some(Status::Ok)
        })
        .await
}
