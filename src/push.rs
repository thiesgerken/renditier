use crate::analysis::performance;
use crate::analysis::performance::PerformanceKind;
use crate::models::*;
use crate::schema::push_subscriptions::dsl::*;

use chrono::{Datelike, Local, Utc};
use diesel::{
    prelude::*,
    r2d2::{ConnectionManager, Pool},
};
use itertools::Itertools;
use log::{error, info};
use serde::Serialize;
use std::collections::HashMap;
use std::error::Error;
use web_push::*;

#[derive(Serialize)]
struct TextPayload {
    text: String,
}

fn daily_notification_body(
    connection: &PgConnection,
    uid: i32,
    kind: PerformanceKind,
) -> Result<String, Box<dyn Error>> {
    let now = Utc::now();
    let mut perf = performance::compute(connection, uid, now)?
        .into_iter()
        .find(|p| p.kind == kind)
        .ok_or("performance empty")?;

    let newest = perf
        .positions
        .iter()
        .filter_map(|(_, p)| p.end.data_source.as_ref().map(|d| d.price.date()))
        .max();

    if let Some(newest) = newest {
        if newest.date() != now.date()
            || now
                .with_timezone(&Local)
                .date()
                .weekday()
                .number_from_monday()
                > 5
        {
            return Ok(String::new());
        }

        // minimize the message footprint
        perf.positions = HashMap::new();
        serde_json::to_string(&perf).map_err(|e| e.into())
    } else {
        Ok(String::new())
    }
}

pub async fn send(
    private_key: &[u8],
    subscription: PushSubscription,
    content: String,
) -> Result<(), Box<dyn Error>> {
    let subscription_info = SubscriptionInfo::new(
        subscription.endpoint,
        subscription.p256dh,
        subscription.auth,
    );
    let mut builder = WebPushMessageBuilder::new(&subscription_info)?;

    let sig_builder = VapidSignatureBuilder::from_pem(private_key, &subscription_info)?;
    builder.set_vapid_signature(sig_builder.build()?);
    builder.set_payload(ContentEncoding::AesGcm, content.as_bytes());

    let message = builder.build()?;

    let client = WebPushClient::new();
    client.send(message).await.map_err(|e| e.into())
}

pub async fn send_welcome_notifications(
    subs: &[PushSubscription],
    private_key: &[u8],
) -> Result<(), Box<dyn Error>> {
    let body = serde_json::to_string(&TextPayload {
        text: "Erfolgreich für Push-Benachrichtigungen registriert!".to_string(),
    })?;
    for sub in subs.iter().filter(|s| s.last_notification.is_none()) {
        if let Err(e) = send(private_key, sub.clone(), body.clone()).await {
            error!(
                "Failed to send welcome notification to device {}: {:?}",
                sub.endpoint, e
            );
        } else {
            info!("Sent welcome notification to device {}", sub.endpoint);
        }
    }

    Ok(())
}

// TODO: also send weekly notifications
// returns error only on serious problems
pub async fn send_daily_notifications(
    pool: Pool<ConnectionManager<PgConnection>>,
    private_key: &[u8],
) -> Result<(), Box<dyn Error>> {
    let connection = pool.get()?;
    let notification_time = Local::now().date().and_hms(20, 0, 0).with_timezone(&Utc);
    let subs = push_subscriptions
        .filter(
            last_notification
                .lt(notification_time)
                .or(last_notification.is_null()),
        )
        .load::<PushSubscription>(&connection)?
        .into_iter()
        .sorted_by_key(|s| s.user_id)
        .collect::<Vec<_>>();

    // update last_notification of all subscriptions, even those that will fail
    let endpoints = subs.iter().map(|s| s.endpoint.clone()).collect::<Vec<_>>();
    diesel::update(push_subscriptions.filter(endpoint.eq_any(endpoints)))
        .set(last_notification.eq(Utc::now()))
        .execute(&connection)?;

    if notification_time > Local::now() {
        return Ok(());
    }

    let mut pending_notifications = Vec::new();

    for (uid, group) in &subs.iter().group_by(|s| s.user_id) {
        let body = daily_notification_body(&connection, uid, PerformanceKind::Today)?;
        if !body.is_empty() {
            for sub in group {
                pending_notifications.push((sub.clone(), body.clone()))
            }
        }
    }

    for (sub, body) in pending_notifications {
        info!("Attempting to send daily notification to {}", sub.endpoint);
        if let Err(e) = send(private_key, sub.clone(), body.clone()).await {
            error!(
                "Failed to send daily notification to {}: {:?}",
                sub.endpoint, e
            );
        } else {
            info!("Sent daily notification to {}", sub.endpoint);
        }
    }

    Ok(())
}
