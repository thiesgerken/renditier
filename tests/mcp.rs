//! The MCP server against a real database and a real server, with an rmcp client.

use chrono::{Duration, NaiveDate, Utc};
use diesel::prelude::*;
use renditier::models::*;
use renditier::schema::*;
use renditier::service::api_keys::{self, Access, NewApiKey};
use rmcp::model::{CallToolRequestParams, CallToolResult};
use rmcp::service::RunningService;
use rmcp::transport::StreamableHttpClientTransport;
use rmcp::transport::streamable_http_client::StreamableHttpClientTransportConfig;
use rmcp::{RoleClient, ServiceExt};
use serde_json::{Value, json};

const ISIN: &str = "DE000MCP0001";
const RECORD: i32 = 990_001;

struct Fixture {
    read_key: String,
    write_key: String,
    account: i32,
    foreign_account: i32,
    foreign_transaction: i32,
}

fn insert_user(c: &mut PgConnection, name: &str) -> (User, Account) {
    let user: User = diesel::insert_into(users::table)
        .values(NewUser {
            name: name.into(),
            full_name: name.into(),
            hash: String::new(),
        })
        .get_result(c)
        .unwrap();
    let account = diesel::insert_into(accounts::table)
        .values(NewAccount {
            user_id: user.id,
            name: "Depot".into(),
            iban: Some("DE00 1234".into()),
        })
        .get_result(c)
        .unwrap();

    (user, account)
}

/// A user who bought a stock with a price history, and someone else.
fn insert_fixture(c: &mut PgConnection) -> Fixture {
    // Unique per run, so a reused scratch database does not trip over earlier runs.
    let run = Utc::now().timestamp_nanos_opt().unwrap();
    let (user, account) = insert_user(c, &format!("agent-{run}"));
    let (_, foreign) = insert_user(c, &format!("other-{run}"));
    let foreign_transaction = diesel::insert_into(transactions::table)
        .values(NewTransaction {
            account_id: foreign.id,
            isin: ISIN.into(),
            date: "2026-03-02T09:00:00Z".parse().unwrap(),
            units: 1.0,
            amount: -10_000,
            fees: 0,
            onvista_exchange_id: None,
            comments: String::new(),
            exchange: None,
            receipt_number: None,
        })
        .returning(transactions::id)
        .get_result(c)
        .unwrap();

    diesel::insert_into(stock_infos::table)
        .values(StockInfo {
            isin: ISIN.into(),
            wkn: "MCP001".into(),
            title: "MCP Test Fund".into(),
            kind: "FUND".into(),
            company: Some("Test Asset Management".into()),
            fonds_type: None,
            focus: None,
            persistent: false,
            onvista_url: String::new(),
            last_historical_update: None,
            last_realtime_update: None,
            industry_breakdown: None,
            instrument_breakdown: None,
            country_breakdown: None,
            currency_breakdown: None,
            holdings: None,
            launch_date: None,
            currency: Some("EUR".into()),
            management_type: None,
            payout_type: None,
            ter: Some(0.002),
            description: None,
            benchmark_index: None,
            instrument_id: None,
        })
        .on_conflict_do_nothing()
        .execute(c)
        .unwrap();
    diesel::insert_into(stock_exchanges::table)
        .values(StockExchange {
            isin: ISIN.into(),
            name: "Xetra".into(),
            code: "GER".into(),
            quality: None,
            onvista_record_id: RECORD,
            onvista_exchange_id: None,
        })
        .on_conflict_do_nothing()
        .execute(c)
        .unwrap();
    for (day, closing) in [(2, 98.0), (3, 99.5)] {
        diesel::insert_into(historical_prices::table)
            .values(HistoricalPrice {
                date: NaiveDate::from_ymd_opt(2026, 3, day).unwrap(),
                opening: closing,
                closing,
                high: closing,
                low: closing,
                volume: 0,
                onvista_record_id: RECORD,
            })
            .on_conflict_do_nothing()
            .execute(c)
            .unwrap();
    }
    diesel::insert_into(realtime_prices::table)
        .values(RealtimePrice {
            date: Utc::now() - Duration::hours(1),
            price: 105.0,
            onvista_record_id: RECORD,
        })
        .execute(c)
        .unwrap();

    diesel::insert_into(transactions::table)
        .values(NewTransaction {
            account_id: account.id,
            isin: ISIN.into(),
            date: "2026-03-02T09:00:00Z".parse().unwrap(),
            units: 10.0,
            amount: -100_000,
            fees: -990,
            onvista_exchange_id: None,
            comments: "savings plan".into(),
            exchange: None,
            receipt_number: None,
        })
        .execute(c)
        .unwrap();

    let mut key = |name: &str, access| {
        api_keys::create(
            c,
            user.id,
            NewApiKey {
                name: name.into(),
                access,
                expires_at: None,
            },
        )
        .unwrap()
        .token
    };

    Fixture {
        read_key: key("reader", Access::Read),
        write_key: key("writer", Access::Write),
        account: account.id,
        foreign_account: foreign.id,
        foreign_transaction,
    }
}

/// The scratch database's URL, migrated once: two tests migrating a fresh database at once
/// collide in the Postgres catalog.
fn database() -> String {
    static MIGRATED: std::sync::Once = std::sync::Once::new();

    let url = std::env::var("RENDITIER_TEST_DATABASE").expect("RENDITIER_TEST_DATABASE not set");
    MIGRATED.call_once(|| {
        renditier::connect(&url).unwrap();
    });
    url
}

/// Launches the server on a free port and returns its base URL once it answers.
async fn serve(database_url: &str) -> String {
    let port = std::net::TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    let server = renditier::web::build(renditier::web::Config {
        port,
        address: "127.0.0.1".into(),
        secret_key: None,
        log_level: rocket::config::LogLevel::Off,
        database_url: database_url.into(),
        authentication_redirect: None,
        trusted_header_authentication: false,
        timezone: chrono_tz::Europe::Berlin,
    });
    // The default pool of four connections per worker per server exhausts a scratch Postgres.
    let figment = server
        .figment()
        .clone()
        .merge(("databases.renditier.pool_size", 2));
    tokio::spawn(server.configure(figment).launch());

    let base = format!("http://127.0.0.1:{port}");
    for _ in 0..100 {
        if reqwest::get(&base).await.is_ok() {
            return base;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    panic!("the server does not come up");
}

async fn connect(base: &str, key: &str) -> RunningService<RoleClient, ()> {
    let config = StreamableHttpClientTransportConfig::with_uri(format!("{base}/mcp"))
        .auth_header(key.to_owned());
    ().serve(StreamableHttpClientTransport::from_config(config))
        .await
        .expect("the client connects")
}

async fn call(
    client: &RunningService<RoleClient, ()>,
    tool: &str,
    arguments: Value,
) -> CallToolResult {
    let Value::Object(arguments) = arguments else {
        panic!("arguments are an object");
    };
    client
        .call_tool(CallToolRequestParams::new(tool.to_owned()).with_arguments(arguments))
        .await
        .expect("the tool answers")
}

async fn structured(
    client: &RunningService<RoleClient, ()>,
    tool: &str,
    arguments: Value,
) -> Value {
    let result = call(client, tool, arguments).await;
    assert_ne!(result.is_error, Some(true), "{tool}: {result:?}");
    result.structured_content.expect("a structured result")
}

/// Needs a scratch Postgres database, which it leaves a user and a test stock in:
/// `RENDITIER_TEST_DATABASE=postgres://... cargo test -- --ignored`
#[tokio::test]
#[ignore = "needs a database in RENDITIER_TEST_DATABASE"]
async fn an_agent_reads_the_portfolio_with_a_read_key() {
    let url = database();
    let fixture = insert_fixture(&mut renditier::connect(&url).unwrap());
    let base = serve(&url).await;
    let client = connect(&base, &fixture.read_key).await;

    let mut tools = client
        .list_all_tools()
        .await
        .unwrap()
        .into_iter()
        .map(|tool| tool.name.into_owned())
        .collect::<Vec<_>>();
    tools.sort();
    assert_eq!(
        tools,
        [
            "get_stock",
            "list_accounts",
            "list_transactions",
            "performance",
            "portfolio",
            "price_history",
            "search_stocks"
        ]
    );

    let accounts = structured(&client, "list_accounts", json!({})).await;
    assert_eq!(
        accounts,
        json!({"accounts": [{"id": fixture.account, "name": "Depot", "iban": "DE00 1234"}]})
    );

    let portfolio = structured(&client, "portfolio", json!({"account": fixture.account})).await;
    let position = &portfolio["positions"][0];
    assert_eq!(position["isin"], ISIN, "{portfolio}");
    assert_eq!(position["invested"], -1009.9);
    assert_eq!(position["value"], 1050.0);
    assert_eq!(position["price"]["exchange"], "Xetra");
    let historic = structured(&client, "portfolio", json!({"date": "2026-03-03"})).await;
    assert_eq!(historic["value"], 995.0, "{historic}");
    for tool in ["portfolio", "performance", "list_transactions"] {
        let foreign = call(&client, tool, json!({"account": fixture.foreign_account})).await;
        assert_eq!(foreign.is_error, Some(true), "{tool}");
        assert!(format!("{foreign:?}").contains("not found"), "{tool}");
    }

    let performance = structured(&client, "performance", json!({})).await;
    assert_eq!(performance["periods"][0]["kind"], "Total", "{performance}");
    assert_eq!(performance["periods"][0]["end"]["invested"], -1009.9);

    let transactions = structured(
        &client,
        "list_transactions",
        json!({"isin": ISIN.to_lowercase(), "from": "2026-03-02", "to": "2026-03-02"}),
    )
    .await;
    let transaction = &transactions["transactions"][0];
    assert_eq!(transaction["amount"], -1000.0, "{transactions}");
    assert_eq!(transaction["fees"], -9.9);
    assert_eq!(transaction["account"], fixture.account);
    let before = structured(&client, "list_transactions", json!({"to": "2026-03-01"})).await;
    assert_eq!(before, json!({"transactions": []}));

    let found = structured(&client, "search_stocks", json!({"query": "mcp test"})).await;
    assert_eq!(found["stocks"][0]["isin"], ISIN, "{found}");
    let stock = structured(&client, "get_stock", json!({"isin": ISIN})).await;
    assert_eq!(stock["latest_price"]["price"], 105.0, "{stock}");
    let history = structured(
        &client,
        "price_history",
        json!({"isin": ISIN, "from": "2026-03-01", "to": "2026-03-31"}),
    )
    .await;
    assert_eq!(
        history,
        json!({"exchange": "Xetra", "prices": [
            {"date": "2026-03-02", "close": 98.0},
            {"date": "2026-03-03", "close": 99.5},
        ]})
    );
}

#[tokio::test]
#[ignore = "needs a database in RENDITIER_TEST_DATABASE"]
async fn mcp_takes_api_keys_only_and_post_only() {
    let url = database();
    let base = serve(&url).await;
    let http = reqwest::Client::new();
    let initialize = json!({
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {"protocolVersion": "2025-06-18", "capabilities": {},
                   "clientInfo": {"name": "test", "version": "1"}},
    });
    let post = |key: &str| {
        http.post(format!("{base}/mcp"))
            .header("accept", "application/json, text/event-stream")
            .header("content-type", "application/json")
            .bearer_auth(key)
            .body(initialize.to_string())
    };

    let anonymous = http
        .post(format!("{base}/mcp"))
        .body(initialize.to_string())
        .send()
        .await
        .unwrap();
    let unknown = post("rk_00000000.unknown").send().await.unwrap();
    let get = http.get(format!("{base}/mcp")).send().await.unwrap();

    assert_eq!(anonymous.status(), 401);
    assert_eq!(unknown.status(), 401);
    assert_eq!(get.status(), 405);
    assert_eq!(get.headers()["allow"], "POST");
}

fn tool_error(result: CallToolResult) -> String {
    assert_eq!(result.is_error, Some(true), "{result:?}");
    format!("{result:?}")
}

#[tokio::test]
#[ignore = "needs a database in RENDITIER_TEST_DATABASE"]
async fn a_write_key_books_changes_and_deletes_only_its_users_transactions() {
    let url = std::env::var("RENDITIER_TEST_DATABASE").expect("RENDITIER_TEST_DATABASE not set");
    let fixture = insert_fixture(&mut renditier::connect(&url).unwrap());
    let base = serve(&url).await;
    let client = connect(&base, &fixture.write_key).await;
    let names = client
        .list_all_tools()
        .await
        .unwrap()
        .into_iter()
        .map(|tool| tool.name.into_owned())
        .collect::<Vec<_>>();
    assert!(
        names.contains(&"delete_transaction".to_owned()),
        "{names:?}"
    );

    let created = structured(
        &client,
        "create_transaction",
        json!({"account": fixture.account, "isin": ISIN.to_lowercase(),
               "date": "2026-04-01T10:00:00+02:00", "units": -2, "amount": 210.5, "fees": -1.5}),
    )
    .await;
    let id = created["id"].clone();
    assert_eq!(created["isin"], ISIN, "{created}");
    assert_eq!(created["date"], "2026-04-01T08:00:00Z");
    assert_eq!(
        (created["amount"].clone(), created["fees"].clone()),
        (json!(210.5), json!(-1.5))
    );

    let updated = structured(
        &client,
        "update_transaction",
        json!({"id": id, "comments": "partial sale"}),
    )
    .await;
    assert_eq!(updated["comments"], "partial sale");
    assert_eq!(updated["amount"], 210.5, "the other fields stay: {updated}");

    assert!(
        tool_error(
            call(
                &client,
                "create_transaction",
                json!({"account": fixture.account, "isin": ISIN, "date": "2026-04-01T10:00:00Z",
                       "units": 1, "amount": 100, "fees": 0}),
            )
            .await
        )
        .contains("negative amount")
    );
    assert!(
        tool_error(
            call(
                &client,
                "create_transaction",
                json!({"account": fixture.foreign_account, "isin": ISIN,
                       "date": "2026-04-01T10:00:00Z", "units": 0, "amount": 1, "fees": 0}),
            )
            .await
        )
        .contains("not found")
    );
    for (tool, arguments) in [
        (
            "update_transaction",
            json!({"id": fixture.foreign_transaction, "comments": "mine now"}),
        ),
        (
            "delete_transaction",
            json!({"id": fixture.foreign_transaction}),
        ),
    ] {
        assert!(tool_error(call(&client, tool, arguments).await).contains("not found"));
    }

    let deleted = structured(&client, "delete_transaction", json!({"id": id})).await;
    assert_eq!(deleted, json!({"deleted": id}));
    let left = structured(&client, "list_transactions", json!({"from": "2026-04-01"})).await;
    assert_eq!(left, json!({"transactions": []}));
}

#[tokio::test]
#[ignore = "needs a database in RENDITIER_TEST_DATABASE"]
async fn a_read_key_cannot_write() {
    let url = std::env::var("RENDITIER_TEST_DATABASE").expect("RENDITIER_TEST_DATABASE not set");
    let fixture = insert_fixture(&mut renditier::connect(&url).unwrap());
    let base = serve(&url).await;
    let client = connect(&base, &fixture.read_key).await;

    let created = call(
        &client,
        "create_transaction",
        json!({"account": fixture.account, "isin": ISIN, "date": "2026-04-01T10:00:00Z",
               "units": 0, "amount": 1, "fees": 0}),
    )
    .await;

    assert!(tool_error(created).contains("needs an API key with write access"));
    let count = transactions::table
        .filter(transactions::account_id.eq(fixture.account))
        .count()
        .get_result::<i64>(&mut renditier::connect(&url).unwrap())
        .unwrap();
    assert_eq!(count, 1);
}
