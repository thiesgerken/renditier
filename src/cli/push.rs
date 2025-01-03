use crate::models::*;
use crate::push;
use crate::schema::push_subscriptions::dsl::*;

use chrono::Utc;
use clap::ArgMatches;
use clap::{Command, Arg, ArgGroup};
use diesel::prelude::*;
use log::info;
use prettytable::{ row, Table};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;

pub fn build() -> Command {
    Command::new("push")
        .about("Push Subscription Management")
        .arg(
            Arg::new("remove")
                .long("remove")
                .value_name("endpoint")
                .help("remove subscription"),
        )
        .arg(
            Arg::new("clear")
                .long("clear")
                .help("remove all subscriptions"),
        )
        .arg(
            Arg::new("test")
                .long("test")
                .value_name("endpoint")
                .help("send a test notification"),
        )
        .arg(Arg::new("list").long("list").help("list subscriptions"))
        .arg(
            Arg::new("full")
                .long("full")
                .help("do not abbreviate endpoints"),
        )
        .group(
            ArgGroup::new("action")
                .args(["test", "remove", "list", "clear"])
                .required(true),
        )
}

#[derive(Serialize, Deserialize, Default, Debug)]
#[serde(default)]
pub struct Config {
    pub key_file: String,
}

pub async fn handle(connection: &mut PgConnection, sub_matches: &ArgMatches, config: Config) {
    if let Some(s_pid) = sub_matches.get_one::<String>("test") {
        let sub = crate::schema::push_subscriptions::table
            .find(&s_pid)
            .load::<PushSubscription>(connection)
            .expect("error loading subscription")
            .into_iter()
            .next()
            .unwrap_or_else(|| panic!("there is no subscription with endpoint '{}'!", &s_pid));

        let mut file = File::open(config.key_file).unwrap();
        let mut private_key = Vec::new();
        file.read_to_end(&mut private_key)
            .expect("failed to read private key");

        push::send(
            &private_key,
            sub,
            format!("{{text: \"test payload, sent at {:?}\"}}", Utc::now()),
        )
        .await
        .expect("failed to send push message");
    } else if let Some(s_pid) = sub_matches.get_one::<String>("remove") {
        crate::schema::push_subscriptions::table
            .find(&s_pid)
            .load::<PushSubscription>(connection)
            .expect("error loading subscription")
            .into_iter()
            .next()
            .unwrap_or_else(|| panic!("there is no subscription with endpoint '{}'!", &s_pid));

        diesel::delete(push_subscriptions.find(&s_pid))
            .execute(connection)
            .unwrap_or_else(|_| panic!("unable to delete subscription {}", &s_pid));

        info!("deleted subscription '{}'", s_pid);
    } else if sub_matches.contains_id("clear") {
        let rows = diesel::delete(push_subscriptions)
            .execute(connection)
            .unwrap();

        info!("deleted {} subscription(s)", rows);
    } else if sub_matches.contains_id("list") {
        let subs = push_subscriptions
            .load::<PushSubscription>(connection)
            .expect("error loading subscriptions");

        let mut table = Table::new();
        table.add_row(row![
            "User ID",
            "Created",
            "Last Contact",
            "Last Notification",
            "Endpoint",
        ]);

        for s in subs.iter() {
            let s_endpoint = if sub_matches.contains_id("full") || s.endpoint.len() <= 45 + 4 {
                s.endpoint.clone()
            } else {
                String::from(&format!("{} ...", &s.endpoint[..45]))
            };

            table.add_row(row![
                s.user_id,
                s.created,
                s.last_contact,
                s.last_notification
                    .map(|d| d.to_string())
                    .unwrap_or_else(String::new),
                s_endpoint,
            ]);
        }

        table.printstd();
    } else {
        panic!("unexpected options for subcommand 'push'");
    }
}
