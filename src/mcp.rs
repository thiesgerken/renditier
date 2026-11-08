//! The MCP server at `/mcp`: the portfolio, its performance, transactions and market data for
//! agents. It answers with the service layer like the REST API, and only takes API keys.
//!
//! Money is in euros as decimals, in and out (the domain counts cents). Signs are the domain's:
//! negative means money goes out of the user's pocket.

use crate::analysis::performance::{PerformanceKind, PortfolioPerformance};
use crate::analysis::portfolio::Portfolio as DomainPortfolio;
use crate::analysis::price::Price;
use crate::models::*;
use crate::service::api_keys::Access;
use crate::service::transactions::TransactionFilter;
use crate::service::{self, DomainError};
use crate::web::DbConn;

use chrono::{DateTime, NaiveDate, NaiveTime, TimeZone, Utc};
use chrono_tz::Tz;
use diesel::PgConnection;
use http::request::Parts;
use log::error;
use rmcp::handler::server::router::tool::ToolRouter;
use rmcp::handler::server::tool::{Extension, ToolCallContext};
use rmcp::handler::server::wrapper::Parameters;
use rmcp::model::{
    CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, ListToolsResult,
    PaginatedRequestParams, ServerCapabilities, ServerConfig, Tool,
};
use rmcp::service::RequestContext;
use rmcp::transport::streamable_http_server::session::never::NeverSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use rmcp::{ErrorData, Json, RoleServer, ServerHandler, tool, tool_router};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Arc;

const INSTRUCTIONS: &str = "Renditier tracks the user's securities portfolio: their accounts \
(depots), the transactions booked into them (buys, sells, dividends, fees), and prices of the \
stocks and funds involved. Money is in euros as decimals everywhere, in arguments and results. \
Signs follow the user's pocket: negative means money goes out (a buy, a fee), positive means it \
comes in (a sale, a dividend). So `invested` is negative while more was bought than sold, and \
the gain is `value + invested`. IRRs are decimals (0.05 is 5 %): `irr_annual` per year, \
`irr_period` over the period it belongs to. Dates are `YYYY-MM-DD` days in the user's time zone.";

/// The `/mcp` endpoint. Stateless: every request stands alone.
pub type Service = StreamableHttpService<Renditier, NeverSessionManager>;

pub fn service(timezone: Tz) -> Service {
    let tools = Renditier::tool_router();
    let config = StreamableHttpServerConfig::default()
        .with_legacy_session_mode(false)
        .with_json_response(true)
        // Host validation guards local servers against DNS rebinding of cookie-less browser
        // requests. Every request here carries an API key, and the Host is the deployment's.
        .disable_allowed_hosts();

    StreamableHttpService::new(
        move || {
            Ok(Renditier {
                timezone,
                tool_router: tools.clone(),
            })
        },
        Arc::new(NeverSessionManager::default()),
        config,
    )
}

/// The owner of the API key a request came with, and what it may do. The `/mcp` route puts it
/// into the request's extensions, next to an `Arc<DbConn>`.
#[derive(Debug, Clone, Copy)]
pub struct Caller {
    pub user_id: i32,
    pub access: Access,
}

impl Caller {
    /// A tool that does not declare itself read-only writes, so a forgotten annotation hides a
    /// tool from read keys rather than handing them a write.
    fn may_use(&self, tool: &Tool) -> bool {
        self.access == Access::Write
            || tool
                .annotations
                .as_ref()
                .and_then(|a| a.read_only_hint)
                .unwrap_or(false)
    }
}

#[derive(Clone)]
pub struct Renditier {
    timezone: Tz,
    tool_router: ToolRouter<Self>,
}

#[derive(Serialize, JsonSchema)]
pub struct Accounts {
    accounts: Vec<AccountOut>,
}

#[derive(Serialize, JsonSchema)]
pub struct AccountOut {
    /// For the `account` argument of the other tools.
    id: i32,
    name: String,
    iban: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct PortfolioArgs {
    /// The portfolio as of the market close on this day, valued at that day's closing prices.
    /// Now, at the latest prices, when left out.
    date: Option<NaiveDate>,
    /// Only this account (an `id` from `list_accounts`). All of the user's accounts when left
    /// out.
    account: Option<i32>,
}

#[derive(Serialize, JsonSchema)]
pub struct Portfolio {
    /// What all positions cost, minus what selling and dividends brought back, fees included.
    /// Negative while more went in than came out.
    invested: f64,
    /// The market value of all positions. Absent when a held position has no price.
    value: Option<f64>,
    irr_annual: Option<f64>,
    positions: Vec<Position>,
}

#[derive(Serialize, JsonSchema)]
pub struct Position {
    isin: String,
    /// Zero for a position that was sold off entirely.
    units: f64,
    invested: f64,
    value: Option<f64>,
    irr_annual: Option<f64>,
    /// The price `value` is based on. Absent when there is none recent enough.
    price: Option<Quote>,
}

#[derive(Serialize, JsonSchema)]
pub struct Quote {
    /// Per unit, in the exchange's currency: euros on the German exchanges preferred here.
    price: f64,
    date: DateTime<Utc>,
    exchange: String,
}

#[derive(Deserialize, JsonSchema)]
pub struct AccountArg {
    /// Only this account (an `id` from `list_accounts`). All of the user's accounts when left
    /// out.
    account: Option<i32>,
}

#[derive(Serialize, JsonSchema)]
pub struct Performances {
    periods: Vec<Performance>,
}

#[derive(Serialize, JsonSchema)]
pub struct Performance {
    /// `Total` since the first transaction, `Today`, `WeekToDate`, `MonthToDate` and
    /// `YearToDate`, or a whole past calendar month (`MonthToMonth`, the last 12) or year
    /// (`YearToYear`).
    kind: PerformanceKind,
    start: Snapshot,
    end: Snapshot,
    irr_annual: Option<f64>,
    irr_period: Option<f64>,
    /// By ISIN.
    positions: BTreeMap<String, PositionPerformance>,
}

#[derive(Serialize, JsonSchema)]
pub struct Snapshot {
    date: NaiveDate,
    /// Units held, absent for the whole portfolio.
    units: Option<f64>,
    /// Up to `date`, fees included.
    invested: f64,
    /// The fees included in `invested`.
    fees: f64,
    value: Option<f64>,
}

#[derive(Serialize, JsonSchema)]
pub struct PositionPerformance {
    start: Snapshot,
    end: Snapshot,
    irr_annual: Option<f64>,
    irr_period: Option<f64>,
}

#[derive(Deserialize, JsonSchema)]
pub struct TransactionsArgs {
    /// Only this account (an `id` from `list_accounts`).
    account: Option<i32>,
    /// Only this stock.
    isin: Option<String>,
    /// Only from this day on.
    from: Option<NaiveDate>,
    /// Only until this day, inclusive.
    to: Option<NaiveDate>,
}

#[derive(Serialize, JsonSchema)]
pub struct Transactions {
    /// Oldest first.
    transactions: Vec<TransactionOut>,
}

#[derive(Serialize, JsonSchema)]
pub struct TransactionOut {
    id: i32,
    account: i32,
    isin: String,
    date: DateTime<Utc>,
    /// Positive for a buy, negative for a sale, zero for a dividend or a fee.
    units: f64,
    /// The price of the units, or the dividend, without fees: negative for a buy, positive for
    /// a sale or dividend.
    amount: f64,
    /// Zero or negative.
    fees: f64,
    comments: String,
    /// Where it was traded, when not over the counter.
    exchange: Option<String>,
    /// The number on the bank's receipt it was booked from.
    receipt_number: Option<i64>,
}

#[derive(Deserialize, JsonSchema)]
pub struct SearchArgs {
    /// An ISIN, a WKN, or part of a stock's or company's name.
    query: String,
}

#[derive(Serialize, JsonSchema)]
pub struct Stocks {
    /// By title, at most 20.
    stocks: Vec<StockSummary>,
}

#[derive(Serialize, JsonSchema)]
pub struct StockSummary {
    isin: String,
    wkn: String,
    title: String,
    /// E.g. `STOCK` or `FUND`.
    kind: String,
    company: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
pub struct IsinArg {
    isin: String,
}

#[derive(Serialize, JsonSchema)]
pub struct Stock {
    isin: String,
    wkn: String,
    title: String,
    kind: String,
    company: Option<String>,
    currency: Option<String>,
    /// Total expense ratio of a fund, as a decimal.
    ter: Option<f64>,
    benchmark_index: Option<String>,
    description: Option<String>,
    /// The newest price over all exchanges, however old.
    latest_price: Option<Quote>,
    exchanges: Vec<ExchangeOut>,
}

#[derive(Serialize, JsonSchema)]
pub struct ExchangeOut {
    name: String,
    code: String,
    /// The newest price on this exchange, however old.
    price: Option<f64>,
    price_date: Option<DateTime<Utc>>,
}

#[derive(Deserialize, JsonSchema)]
pub struct HistoryArgs {
    isin: String,
    from: NaiveDate,
    /// Inclusive.
    to: NaiveDate,
}

#[derive(Serialize, JsonSchema)]
pub struct History {
    /// Where the prices are from: the most preferred exchange that has any in the range.
    /// Absent, like the prices, when none has.
    exchange: Option<String>,
    /// One per trading day, oldest first, in the exchange's currency.
    prices: Vec<Close>,
}

#[derive(Serialize, JsonSchema)]
pub struct Close {
    date: NaiveDate,
    close: f64,
}

#[derive(Deserialize, JsonSchema)]
pub struct NewTransactionArgs {
    /// An `id` from `list_accounts`.
    account: i32,
    isin: String,
    /// When it was traded or paid, RFC 3339 with an offset, e.g. `2026-03-02T09:00:00+01:00`.
    date: DateTime<Utc>,
    /// Positive for a buy, negative for a sale, zero for a dividend or a fee.
    units: f64,
    /// Euros, without fees: negative for a buy (money goes out), positive for a sale or a
    /// dividend. At most two decimals.
    amount: f64,
    /// Euros, zero or negative. At most two decimals.
    fees: f64,
    #[serde(default)]
    comments: String,
    /// Where it was traded, when not over the counter.
    exchange: Option<String>,
    /// The number on the bank's receipt, which lets a receipt upload skip it as a duplicate.
    receipt_number: Option<i64>,
}

#[derive(Deserialize, JsonSchema)]
pub struct UpdateTransactionArgs {
    /// The transaction's `id`.
    id: i32,
    /// Fields left out keep their value. The same units and signs as for
    /// `create_transaction`.
    account: Option<i32>,
    isin: Option<String>,
    date: Option<DateTime<Utc>>,
    units: Option<f64>,
    amount: Option<f64>,
    fees: Option<f64>,
    comments: Option<String>,
    exchange: Option<String>,
    receipt_number: Option<i64>,
}

#[derive(Deserialize, JsonSchema)]
pub struct IdArg {
    /// The transaction's `id`.
    id: i32,
}

#[derive(Serialize, JsonSchema)]
pub struct Deleted {
    deleted: i32,
}

#[tool_router]
impl Renditier {
    #[tool(
        description = "List the user's accounts (depots) with their ids, for the `account` \
        argument of the other tools.",
        annotations(read_only_hint = true, open_world_hint = false)
    )]
    async fn list_accounts(
        &self,
        Extension(parts): Extension<Parts>,
    ) -> Result<Json<Accounts>, String> {
        let accounts = run(&parts, |c, user| {
            service::accounts::list(c, user, None, None)
        })
        .await?;

        Ok(Json(Accounts {
            accounts: accounts
                .into_iter()
                .map(|a| AccountOut {
                    id: a.id,
                    name: a.name,
                    iban: a.iban,
                })
                .collect(),
        }))
    }

    #[tool(
        description = "The user's portfolio: what each position cost and is worth, and its \
        IRR. Now at the latest prices, or as of a past day's market close. Euros as decimals, \
        negative `invested` means money went in.",
        annotations(read_only_hint = true, open_world_hint = false)
    )]
    async fn portfolio(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(args): Parameters<PortfolioArgs>,
    ) -> Result<Json<Portfolio>, String> {
        let portfolio = match args.date {
            Some(date) => {
                run(&parts, move |c, user| {
                    service::analysis::historic_portfolio(c, user, args.account, date)
                        .map(portfolio_out)
                })
                .await?
            }
            None => {
                run(&parts, move |c, user| {
                    service::analysis::portfolio(c, user, args.account, Utc::now())
                        .map(portfolio_out)
                })
                .await?
            }
        };

        Ok(Json(portfolio))
    }

    #[tool(
        description = "How the user's portfolio performed: in total, today, week, month and \
        year to date, in each of the last 12 calendar months and in each past calendar year. \
        Each period has its start and end snapshot, its IRR per year and over the period, and \
        the same per position. Euros as decimals.",
        annotations(read_only_hint = true, open_world_hint = false)
    )]
    async fn performance(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(args): Parameters<AccountArg>,
    ) -> Result<Json<Performances>, String> {
        let timezone = self.timezone;
        let periods = run(&parts, move |c, user| {
            service::analysis::performance(c, user, args.account, Utc::now(), timezone)
        })
        .await?;

        Ok(Json(Performances {
            periods: periods.into_iter().map(performance_out).collect(),
        }))
    }

    #[tool(
        description = "List the user's transactions (buys, sells, dividends, fees), oldest \
        first, optionally narrowed to an account, a stock and a range of days. Euros as \
        decimals: `amount` and `fees` are negative when money goes out.",
        annotations(read_only_hint = true, open_world_hint = false)
    )]
    async fn list_transactions(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(args): Parameters<TransactionsArgs>,
    ) -> Result<Json<Transactions>, String> {
        let filter = TransactionFilter {
            account_id: args.account,
            isin: args.isin,
            from: args.from.map(|d| day_start(d, self.timezone)).transpose()?,
            until: args
                .to
                .map(|d| day_start(d + chrono::Days::new(1), self.timezone))
                .transpose()?,
        };
        let mut transactions = run(&parts, move |c, user| {
            service::transactions::list(c, user, filter, None, None)
        })
        .await?;
        transactions.sort_by_key(|t| t.date);

        Ok(Json(Transactions {
            transactions: transactions.into_iter().map(transaction_out).collect(),
        }))
    }

    #[tool(
        description = "Find stocks and funds Renditier knows by ISIN, WKN, or part of their \
        or their company's name. Use `get_stock` for the details and the price.",
        annotations(read_only_hint = true, open_world_hint = false)
    )]
    async fn search_stocks(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(args): Parameters<SearchArgs>,
    ) -> Result<Json<Stocks>, String> {
        let stocks = run(&parts, move |c, _| service::stocks::search(c, &args.query)).await?;

        Ok(Json(Stocks {
            stocks: stocks
                .into_iter()
                .map(|s| StockSummary {
                    isin: s.isin,
                    wkn: s.wkn,
                    title: s.title,
                    kind: s.kind,
                    company: s.company,
                })
                .collect(),
        }))
    }

    #[tool(
        description = "A stock or fund by ISIN: what it is, and its latest price on each \
        exchange it trades on.",
        annotations(read_only_hint = true, open_world_hint = false)
    )]
    async fn get_stock(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(args): Parameters<IsinArg>,
    ) -> Result<Json<Stock>, String> {
        let stock = run(&parts, move |c, _| service::stocks::get(c, &args.isin)).await?;

        Ok(Json(stock_out(stock)))
    }

    #[tool(
        description = "Daily closing prices of a stock or fund by ISIN, from one exchange. Keep \
        the range as short as the question allows: a year is about 250 prices.",
        annotations(read_only_hint = true, open_world_hint = false)
    )]
    async fn price_history(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(args): Parameters<HistoryArgs>,
    ) -> Result<Json<History>, String> {
        let history = run(&parts, move |c, _| {
            service::prices::history(c, &args.isin, args.from, args.to)
        })
        .await?;

        Ok(Json(match history {
            Some((exchange, prices)) => History {
                exchange: Some(exchange.name),
                prices: prices
                    .into_iter()
                    .map(|p| Close {
                        date: p.date,
                        close: p.closing,
                    })
                    .collect(),
            },
            None => History {
                exchange: None,
                prices: Vec::new(),
            },
        }))
    }

    #[tool(
        description = "Book a transaction (buy, sell, dividend or fee) into one of the user's \
        accounts. Only on the user's explicit instruction. Euros as decimals, negative when \
        money goes out: a buy has positive `units` and a negative `amount`, a sale the other way \
        round, and `fees` are never positive.",
        annotations(
            read_only_hint = false,
            destructive_hint = false,
            idempotent_hint = false,
            open_world_hint = false
        )
    )]
    async fn create_transaction(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(args): Parameters<NewTransactionArgs>,
    ) -> Result<Json<TransactionOut>, String> {
        let transaction = NewTransaction {
            account_id: args.account,
            isin: args.isin.to_uppercase(),
            date: args.date,
            units: args.units,
            amount: cents(args.amount)?,
            fees: cents(args.fees)?,
            onvista_exchange_id: None,
            comments: args.comments,
            exchange: args.exchange,
            receipt_number: args.receipt_number,
        };
        check_signs(transaction.units, transaction.amount, transaction.fees)?;

        let created = run(&parts, move |c, user| {
            service::transactions::create(c, user, transaction)
        })
        .await?;

        Ok(Json(transaction_out(created)))
    }

    #[tool(
        description = "Change a transaction of the user. Only the fields given change. Only on \
        the user's explicit instruction. Euros as decimals, with the signs of \
        create_transaction.",
        annotations(
            read_only_hint = false,
            destructive_hint = true,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    async fn update_transaction(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(args): Parameters<UpdateTransactionArgs>,
    ) -> Result<Json<TransactionOut>, String> {
        let amount = args.amount.map(cents).transpose()?;
        let fees = args.fees.map(cents).transpose()?;

        let updated = run(&parts, move |c, user| {
            let stored = service::transactions::get(c, user, args.id)?;
            let transaction = Transaction {
                account_id: args.account.unwrap_or(stored.account_id),
                isin: args.isin.map_or(stored.isin, |i| i.to_uppercase()),
                date: args.date.unwrap_or(stored.date),
                units: args.units.unwrap_or(stored.units),
                amount: amount.unwrap_or(stored.amount),
                fees: fees.unwrap_or(stored.fees),
                comments: args.comments.unwrap_or(stored.comments),
                exchange: args.exchange.or(stored.exchange),
                receipt_number: args.receipt_number.or(stored.receipt_number),
                ..stored
            };
            check_signs(transaction.units, transaction.amount, transaction.fees)
                .map_err(DomainError::Invalid)?;

            service::transactions::update(c, user, args.id, transaction.clone())?;
            Ok(transaction)
        })
        .await?;

        Ok(Json(transaction_out(updated)))
    }

    #[tool(
        description = "Delete a transaction of the user for good. Only on the user's explicit \
        instruction.",
        annotations(
            read_only_hint = false,
            destructive_hint = true,
            idempotent_hint = true,
            open_world_hint = false
        )
    )]
    async fn delete_transaction(
        &self,
        Extension(parts): Extension<Parts>,
        Parameters(args): Parameters<IdArg>,
    ) -> Result<Json<Deleted>, String> {
        run(&parts, move |c, user| {
            service::transactions::delete(c, user, args.id)
        })
        .await?;

        Ok(Json(Deleted { deleted: args.id }))
    }
}

impl ServerHandler for Renditier {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions(INSTRUCTIONS)
    }

    async fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        context: RequestContext<RoleServer>,
    ) -> Result<ListToolsResult, ErrorData> {
        let caller = context_caller(&context);
        let tools = self
            .tool_router
            .list_all()
            .into_iter()
            .filter(|tool| caller.may_use(tool))
            .collect();

        Ok(ListToolsResult::with_all_items(tools))
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, ErrorData> {
        if let Some(tool) = self.tool_router.get(&request.name)
            && !context_caller(&context).may_use(tool)
        {
            return Ok(CallToolResult::error(vec![ContentBlock::text(format!(
                "{} needs an API key with write access",
                request.name
            ))])
            .into());
        }

        self.tool_router
            .call(ToolCallContext::new(self, request, context))
            .await
    }

    fn get_tool(&self, name: &str) -> Option<Tool> {
        self.tool_router.get(name).cloned()
    }
}

/// The `/mcp` route puts both into every request.
fn caller(parts: &Parts) -> Caller {
    *parts
        .extensions
        .get::<Caller>()
        .expect("/mcp authenticates every request")
}

fn context_caller(context: &RequestContext<RoleServer>) -> Caller {
    caller(
        context
            .extensions
            .get::<Parts>()
            .expect("the HTTP transport hands over the request"),
    )
}

/// Runs `f` with the caller's user id on the request's database connection.
async fn run<T: Send + 'static>(
    parts: &Parts,
    f: impl FnOnce(&mut PgConnection, i32) -> Result<T, DomainError> + Send + 'static,
) -> Result<T, String> {
    let user_id = caller(parts).user_id;
    let connection = parts
        .extensions
        .get::<Arc<DbConn>>()
        .expect("/mcp hands over a database connection")
        .clone();

    connection
        .run(move |c| f(c, user_id))
        .await
        .map_err(|e| match e {
            DomainError::NotFound => "not found".to_owned(),
            DomainError::Invalid(message) => message,
            DomainError::Internal(message) => {
                error!("{message}");
                "internal error".to_owned()
            }
        })
}

/// Where `date` begins in the user's time zone.
fn day_start(date: NaiveDate, timezone: Tz) -> Result<DateTime<Utc>, String> {
    timezone
        .from_local_datetime(&date.and_time(NaiveTime::MIN))
        .earliest()
        .map(|t| t.with_timezone(&Utc))
        .ok_or_else(|| format!("{date} has no midnight in {timezone}"))
}

fn euros(cents: i64) -> f64 {
    cents as f64 / 100.0
}

/// Refuses fractions of a cent rather than rounding them away unnoticed.
fn cents(euros: f64) -> Result<i64, String> {
    let cents = (euros * 100.0).round();
    if !euros.is_finite() || (euros * 100.0 - cents).abs() > 1e-6 {
        return Err(format!(
            "{euros} is not an amount of euros with at most two decimals"
        ));
    }

    Ok(cents as i64)
}

/// The signs an agent is most likely to get wrong, checked before they end up in the books.
fn check_signs(units: f64, amount: i64, fees: i64) -> Result<(), String> {
    if fees > 0 {
        return Err("fees are money going out, so they are zero or negative".into());
    }
    if units > 0.0 && amount > 0 {
        return Err("a buy (positive units) has a negative amount: the money goes out".into());
    }
    if units < 0.0 && amount < 0 {
        return Err("a sale (negative units) has a positive amount: the money comes in".into());
    }

    Ok(())
}

fn portfolio_out<T: Price>(p: DomainPortfolio<T>) -> Portfolio {
    Portfolio {
        invested: p.invested,
        value: p.value,
        irr_annual: p.irr,
        positions: p
            .stocks
            .into_iter()
            .map(|s| Position {
                isin: s.isin,
                units: s.units,
                invested: s.invested,
                value: s.value,
                irr_annual: s.irr,
                price: s.data_source.map(|d| Quote {
                    price: d.price.value(),
                    date: d.price.date(),
                    exchange: d.exchange.name,
                }),
            })
            .collect(),
    }
}

fn performance_out(p: PortfolioPerformance) -> Performance {
    Performance {
        kind: p.kind,
        start: Snapshot {
            date: p.start.date,
            units: None,
            invested: p.start.invested,
            fees: p.start.fees,
            value: p.start.value,
        },
        end: Snapshot {
            date: p.end.date,
            units: None,
            invested: p.end.invested,
            fees: p.end.fees,
            value: p.end.value,
        },
        irr_annual: p.irr_annual,
        irr_period: p.irr_period,
        positions: p
            .positions
            .into_iter()
            .map(|(isin, p)| {
                let snapshot = |s: crate::analysis::performance::PositionSnapshot| Snapshot {
                    date: s.date,
                    units: Some(s.units),
                    invested: s.invested,
                    fees: s.fees,
                    value: s.value,
                };
                let position = PositionPerformance {
                    start: snapshot(p.start),
                    end: snapshot(p.end),
                    irr_annual: p.irr_annual,
                    irr_period: p.irr_period,
                };
                (isin, position)
            })
            .collect(),
    }
}

fn transaction_out(t: Transaction) -> TransactionOut {
    TransactionOut {
        id: t.id,
        account: t.account_id,
        isin: t.isin,
        date: t.date,
        units: t.units,
        amount: euros(t.amount),
        fees: euros(t.fees),
        comments: t.comments,
        exchange: t.exchange,
        receipt_number: t.receipt_number,
    }
}

fn stock_out(s: service::stocks::Stock) -> Stock {
    let latest_price = s
        .exchanges
        .iter()
        .filter_map(|e| e.current_price.as_ref().map(|p| (e, p)))
        .max_by_key(|(_, p)| p.date)
        .map(|(e, p)| Quote {
            price: p.price,
            date: p.date,
            exchange: e.name.clone(),
        });

    Stock {
        isin: s.info.isin,
        wkn: s.info.wkn,
        title: s.info.title,
        kind: s.info.kind,
        company: s.info.company,
        currency: s.info.currency,
        ter: s.info.ter,
        benchmark_index: s.info.benchmark_index,
        description: s.info.description,
        latest_price,
        exchanges: s
            .exchanges
            .into_iter()
            .map(|e| ExchangeOut {
                name: e.name,
                code: e.code,
                price: e.current_price.as_ref().map(|p| p.price),
                price_date: e.current_price.map(|p| p.date),
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rmcp::model::ToolAnnotations;

    #[test]
    fn read_keys_get_only_tools_that_declare_themselves_read_only() {
        let tool = |read_only: Option<bool>| {
            let tool = Tool::new("t", "", Arc::new(Default::default()));
            match read_only {
                Some(hint) => tool.annotate(ToolAnnotations::new().read_only(hint)),
                None => tool,
            }
        };
        let read = Caller {
            user_id: 1,
            access: Access::Read,
        };
        let write = Caller {
            user_id: 1,
            access: Access::Write,
        };

        assert!(read.may_use(&tool(Some(true))));
        assert!(!read.may_use(&tool(Some(false))));
        assert!(!read.may_use(&tool(None)));
        assert!(write.may_use(&tool(Some(false))));
        assert!(write.may_use(&tool(None)));
    }

    #[test]
    fn euros_become_cents_without_losing_a_fraction() {
        assert_eq!(cents(-1000.0), Ok(-100_000));
        assert_eq!(cents(-9.9), Ok(-990));
        assert_eq!(cents(0.07), Ok(7));
        assert!(cents(1.234).is_err());
        assert!(cents(f64::NAN).is_err());
    }

    #[test]
    fn buys_cost_sales_earn_and_fees_cost() {
        assert_eq!(check_signs(10.0, -100_000, -990), Ok(()));
        assert_eq!(check_signs(-10.0, 100_000, -990), Ok(()));
        assert_eq!(check_signs(0.0, 1_500, 0), Ok(()));
        assert!(check_signs(10.0, 100_000, 0).is_err());
        assert!(check_signs(-10.0, -100_000, 0).is_err());
        assert!(check_signs(10.0, -100_000, 990).is_err());
    }
}
