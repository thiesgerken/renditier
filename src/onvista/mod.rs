mod crypto;
mod etc;
mod etf;
mod json_utils;
mod stock;

use crate::models::*;
use crate::onvista::json_utils::*;

use chrono::{DateTime, NaiveDate};
use chrono_tz::Tz;
use itertools::izip;
use log::debug;
use serde_json::Value;
use std::error::Error;

/// onvista quotes German exchanges; their prices and timestamps are in German local time. Crypto
/// currencies are quoted on Bitstamp in UTC, but their daily prices are filed the same way.
pub const EXCHANGE_TIMEZONE: Tz = chrono_tz::Europe::Berlin;

const API_URL: &str = "https://api.onvista.de/api/v1";
const WEBSITE_URL: &str = "https://www.onvista.de";
const USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64; rv:97.0) Gecko/20100101 Firefox/97.0";

/// onvista's classification of instruments, which decides the API endpoints to use.
#[derive(Debug, Clone, Copy)]
enum EntityType {
    Fund,
    Stock,
    Derivative,
    Crypto,
}

impl EntityType {
    const ALL: [EntityType; 4] = [Self::Fund, Self::Stock, Self::Derivative, Self::Crypto];

    fn from_api_name(name: &str) -> Result<Self, String> {
        Self::ALL
            .iter()
            .copied()
            .find(|t| t.api_name() == name)
            .ok_or_else(|| format!("unsupported onvista entity type {name}"))
    }

    fn from_kind(kind: &str) -> Result<Self, String> {
        match kind {
            // stocks of an older stockdb version still carry this kind
            "ETN" => Ok(Self::Derivative),
            _ => Self::ALL
                .iter()
                .copied()
                .find(|t| t.kind() == kind)
                .ok_or_else(|| format!("unsupported stock kind {kind}")),
        }
    }

    fn api_name(self) -> &'static str {
        match self {
            Self::Fund => "FUND",
            Self::Stock => "STOCK",
            Self::Derivative => "DERIVATIVE",
            Self::Crypto => "CRYPTO",
        }
    }

    /// The prefix of the type's own endpoints, which find an instrument by its ISIN.
    fn api_path(self) -> Option<&'static str> {
        match self {
            Self::Fund => Some("funds"),
            Self::Stock => Some("stocks"),
            Self::Derivative => Some("derivatives"),
            Self::Crypto => None,
        }
    }

    /// value of `StockInfo::kind`
    fn kind(self) -> &'static str {
        match self {
            Self::Fund => "ETF",
            Self::Stock => "Aktie",
            Self::Derivative => "ETC",
            Self::Crypto => "Krypto",
        }
    }
}

pub async fn get_info(needle: &str) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let params = qstring::QString::new(vec![("searchValue", needle)]);
    let results = get_json(&format!("instruments/query?{params}")).await?;
    let hit = get_array(&results["list"])
        .and_then(|list| list.first())
        .ok_or_else(|| format!("onvista search for {needle} returned nothing"))?;
    let entity_type = EntityType::from_api_name(
        &get_string(&hit["entityType"]).ok_or("error parsing entity type")?,
    )?;
    let isin = get_string(&hit["isin"]).ok_or("error parsing isin")?;
    debug!("recognized {needle} as {entity_type:?} {isin}");

    let snapshot = match entity_type {
        EntityType::Crypto => {
            let entity_value =
                get_string(&hit["entityValue"]).ok_or("error parsing entity value")?;
            get_crypto_snapshot(&entity_value).await?
        }
        _ => get_instrument_json(entity_type, &isin, "snapshot").await?,
    };
    let info = match entity_type {
        EntityType::Fund => etf::parse_info(
            &snapshot,
            &get_instrument_json(entity_type, &isin, "breakdowns").await?,
        )?,
        EntityType::Stock => stock::parse_info(
            &snapshot,
            &get_instrument_json(entity_type, &isin, "company_snapshot").await?,
        )?,
        EntityType::Derivative => etc::parse_info(&snapshot)?,
        EntityType::Crypto => crypto::parse_info(&snapshot)?,
    };
    let quotes = match entity_type {
        EntityType::Crypto => vec![get_crypto_quote(&isin).await?],
        _ => snapshot_quotes(&snapshot)?.clone(),
    };
    let exchanges = quotes
        .iter()
        .map(|q| parse_exchange(&info.isin, q).ok_or_else(|| format!("error parsing quote {q}")))
        .collect::<Result<Vec<_>, _>>()?;

    Ok((info, exchanges))
}

pub async fn get_data_realtime(stock: &StockInfo) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
    let entity_type = EntityType::from_kind(&stock.kind)?;
    let quotes = match entity_type {
        EntityType::Crypto => vec![get_crypto_quote(&stock.isin).await?],
        _ => {
            let snapshot = get_instrument_json(entity_type, &stock.isin, "snapshot").await?;
            snapshot_quotes(&snapshot)?.clone()
        }
    };

    Ok(quotes
        .iter()
        .map(|q| parse_price(q).ok_or_else(|| format!("error parsing quote {q}")))
        .collect::<Result<Vec<_>, _>>()?)
}

pub async fn get_data_historical(
    stock: &StockInfo,
    onvista_record_id: i32,
    start: NaiveDate,
) -> Result<Vec<HistoricalPrice>, Box<dyn Error>> {
    let entity_type = EntityType::from_kind(&stock.kind)?;
    let history = get_json(&format!(
        "instruments/{}/ISIN:{}/eod_history?idNotation={onvista_record_id}&range=Y5&startDate={}",
        entity_type.api_name(),
        stock.isin,
        start.format("%Y-%m-%d"),
    ))
    .await?;

    let dates = get_array(&history["datetimeLast"])
        .ok_or("error obtaining dates")?
        .iter()
        .map(|t| {
            get_i64(t)
                .and_then(|secs| DateTime::from_timestamp(secs, 0))
                .map(|datetime| datetime.date_naive())
                .ok_or_else(|| format!("error parsing date {t}"))
        })
        .collect::<Result<Vec<_>, _>>()?;
    let column = |name: &str| {
        get_array(&history[name])
            .ok_or_else(|| format!("error obtaining {name} values"))?
            .iter()
            .map(|x| get_f64(x).ok_or_else(|| format!("error parsing {name} value {x}")))
            .collect::<Result<Vec<_>, _>>()
    };

    Ok(izip!(
        dates,
        column("first")?,
        column("last")?,
        column("low")?,
        column("high")?,
        column("volume")?
    )
    .map(
        |(date, opening, closing, low, high, volume)| HistoricalPrice {
            date,
            opening,
            closing,
            low,
            high,
            volume: volume as i32,
            onvista_record_id,
        },
    )
    .collect())
}

/// Fills the fields that all kinds of instruments share and leaves the kind-specific ones empty.
fn parse_base_info(
    snapshot: &Value,
    entity_type: EntityType,
    title: String,
    company: Option<String>,
    currency: String,
) -> Result<StockInfo, Box<dyn Error>> {
    let instrument = &snapshot["instrument"];
    let website = get_string(&instrument["urls"]["WEBSITE"]).ok_or("error parsing website url")?;
    let onvista_url = website
        .strip_prefix(WEBSITE_URL)
        .ok_or_else(|| format!("website url {website} does not begin with {WEBSITE_URL}"))?
        .to_string();

    Ok(StockInfo {
        isin: get_string(&instrument["isin"]).ok_or("error parsing isin")?,
        wkn: get_string(&instrument["wkn"]).ok_or("error parsing wkn")?,
        title,
        kind: entity_type.kind().to_string(),
        company,
        fonds_type: None,
        focus: None,
        persistent: false,
        onvista_url,
        last_historical_update: None,
        last_realtime_update: None,
        industry_breakdown: None,
        instrument_breakdown: None,
        country_breakdown: None,
        currency_breakdown: None,
        holdings: None,
        launch_date: None,
        currency: Some(currency),
        management_type: None,
        payout_type: None,
        ter: None,
        description: None,
        benchmark_index: None,
        instrument_id: Some(
            get_string(&instrument["entityValue"]).ok_or("error parsing instrument id")?,
        ),
    })
}

/// Fetches one of the per-instrument endpoints, e.g. `snapshot`.
async fn get_instrument_json(
    entity_type: EntityType,
    isin: &str,
    endpoint: &str,
) -> Result<Value, Box<dyn Error>> {
    let api_path = entity_type
        .api_path()
        .ok_or_else(|| format!("onvista has no {entity_type:?} endpoints"))?;
    get_json(&format!("{api_path}/ISIN:{isin}/{endpoint}")).await
}

/// onvista does not find the snapshot of a crypto currency by its ISIN, only by its entity value
/// (e.g. `BTCEUR`).
async fn get_crypto_snapshot(entity_value: &str) -> Result<Value, Box<dyn Error>> {
    get_json(&format!(
        "instruments/{}/{entity_value}/snapshot",
        EntityType::Crypto.api_name()
    ))
    .await
}

/// The quote of a crypto currency on its default exchange (Bitstamp), which is the one exchange
/// stockdb tracks it on. The snapshot's quote list is no alternative: it holds Bitfinex quotes
/// in EUR and USD alike.
async fn get_crypto_quote(isin: &str) -> Result<Value, Box<dyn Error>> {
    get_json(&format!(
        "instruments/{}/ISIN:{isin}/quote",
        EntityType::Crypto.api_name()
    ))
    .await
}

async fn get_json(path: &str) -> Result<Value, Box<dyn Error>> {
    let url = format!("{API_URL}/{path}");
    debug!("Making request to {url}");
    let resp = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(format!("Request to {url} unsuccessful: status {}", resp.status()).into());
    }

    Ok(serde_json::from_str(&resp.text().await?)?)
}

/// One entry per exchange the instrument is traded on.
fn snapshot_quotes(snapshot: &Value) -> Result<&Vec<Value>, &'static str> {
    get_array(&snapshot["quoteList"]["list"]).ok_or("error parsing quote list")
}

fn parse_exchange(isin: &str, quote: &Value) -> Option<StockExchange> {
    Some(StockExchange {
        isin: isin.to_string(),
        onvista_exchange_id: None,
        onvista_record_id: get_i64(&quote["market"]["idNotation"])? as i32,
        code: get_string(&quote["market"]["codeExchange"])?,
        quality: Some(get_string(&quote["codeQualityPrice"])?),
        name: get_string(&quote["market"]["name"])?,
    })
}

fn parse_price(quote: &Value) -> Option<RealtimePrice> {
    // some exchanges (e.g. Xetra for ETCs) only publish one of the two
    let (price, date) = get_f64(&quote["last"])
        .zip(get_timestamp(&quote["datetimeLast"]))
        .or_else(|| get_f64(&quote["bid"]).zip(get_timestamp(&quote["datetimeBid"])))?;

    Some(RealtimePrice {
        onvista_record_id: get_i64(&quote["market"]["idNotation"])? as i32,
        price,
        date,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    use chrono::{Duration, TimeZone, Utc};
    use test_log::test;

    /// A real onvista response, trimmed to what the parsers read, from `src/onvista/fixtures`.
    pub(super) fn fixture(name: &str) -> Value {
        let path = format!(
            "{}/src/onvista/fixtures/{name}.json",
            env!("CARGO_MANIFEST_DIR")
        );
        let json = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"));
        serde_json::from_str(&json).unwrap()
    }

    /// Tradegate's quote of the Vanguard FTSE All-World, which has both a last and a bid price.
    fn tradegate_quote() -> Value {
        snapshot_quotes(&fixture("etf_snapshot")).unwrap()[1].clone()
    }

    #[test]
    fn test_snapshot_quotes() {
        assert_eq!(snapshot_quotes(&fixture("etf_snapshot")).unwrap().len(), 3);
    }

    #[test]
    fn test_parse_exchange() {
        let exchange = parse_exchange("IE00BK5BQT80", &tradegate_quote()).unwrap();

        assert_eq!(exchange.isin, "IE00BK5BQT80");
        assert_eq!(exchange.onvista_record_id, 264715168);
        assert_eq!(exchange.onvista_exchange_id, None);
        assert_eq!(exchange.code, "GAT");
        assert_eq!(exchange.name, "Tradegate BSX");
        assert_eq!(exchange.quality.as_deref(), Some("RLT"));
    }

    #[test]
    fn test_parse_price() {
        let price = parse_price(&tradegate_quote()).unwrap();

        assert_eq!(price.onvista_record_id, 264715168);
        assert_eq!(price.price, 164.76);
        assert_eq!(
            price.date,
            Utc.with_ymd_and_hms(2026, 11, 6, 21, 3, 10).unwrap() + Duration::milliseconds(80)
        );
    }

    #[test]
    fn test_parse_price_falls_back_to_bid() {
        let mut quote = tradegate_quote();
        quote.as_object_mut().unwrap().remove("last");
        let price = parse_price(&quote).unwrap();

        assert_eq!(price.price, 164.62);
        assert_eq!(
            price.date,
            Utc.with_ymd_and_hms(2026, 11, 6, 21, 2, 1).unwrap() + Duration::milliseconds(560)
        );
    }

    #[test]
    fn test_parse_price_without_any_price() {
        let mut quote = tradegate_quote();
        let fields = quote.as_object_mut().unwrap();
        fields.remove("last");
        fields.remove("bid");

        assert!(parse_price(&quote).is_none());
    }

    #[test]
    fn test_parse_crypto_quote() {
        let quote = fixture("crypto_quote");

        let exchange = parse_exchange("EU000A2YZK67", &quote).unwrap();
        assert_eq!(exchange.onvista_record_id, 213086260);
        assert_eq!(exchange.code, "BTC");
        assert_eq!(exchange.name, "Bitstamp Currencies");
        assert_eq!(exchange.quality.as_deref(), Some("RLT"));

        let price = parse_price(&quote).unwrap();
        assert_eq!(price.onvista_record_id, 213086260);
        assert_eq!(price.price, 67957.57);
        assert_eq!(
            price.date,
            Utc.with_ymd_and_hms(2026, 11, 7, 20, 5, 47).unwrap() + Duration::milliseconds(310)
        );
    }

    async fn check_info(isin: &str, kind: &str) {
        let (info, exs) = get_info(isin).await.unwrap();

        log::info!("{info:?}");
        log::info!("{exs:?}");

        assert_eq!(info.isin, isin);
        assert_eq!(info.kind, kind);
        assert_ne!(exs.len(), 0);
    }

    async fn check_realtime(isin: &str) {
        let (info, _) = get_info(isin).await.unwrap();

        let data = get_data_realtime(&info).await.unwrap();
        assert_ne!(data.len(), 0)
    }

    async fn check_historical(isin: &str) {
        let (info, exs) = get_info(isin).await.unwrap();

        let data = get_data_historical(
            &info,
            exs[0].onvista_record_id,
            Utc::now()
                .with_timezone(&EXCHANGE_TIMEZONE)
                .date_naive()
                .checked_sub_signed(Duration::weeks(2))
                .unwrap(),
        )
        .await
        .unwrap();

        // (this might actually fail, the exchange could be inactive for the stock)
        assert_ne!(data.len(), 0);
        assert!(data.iter().any(|p| p.closing != p.opening));
    }

    #[test(tokio::test)]
    async fn test_stock_info() {
        check_info("DE0007164600", "Aktie").await
    }

    #[test(tokio::test)]
    async fn test_stock_realtime() {
        check_realtime("DE0007164600").await
    }

    #[test(tokio::test)]
    async fn test_stock_historical() {
        check_historical("DE0007164600").await
    }

    #[test(tokio::test)]
    async fn test_etf_info() {
        check_info("IE00BK5BQT80", "ETF").await
    }

    #[test(tokio::test)]
    async fn test_etf_realtime() {
        check_realtime("IE00BK5BQT80").await
    }

    #[test(tokio::test)]
    async fn test_etf_historical() {
        check_historical("IE00BK5BQT80").await
    }

    #[test(tokio::test)]
    async fn test_etc_info() {
        check_info("DE000EWG2LD7", "ETC").await
    }

    #[test(tokio::test)]
    async fn test_etc_realtime() {
        check_realtime("DE000EWG2LD7").await
    }

    #[test(tokio::test)]
    async fn test_etc_historical() {
        check_historical("DE000EWG2LD7").await
    }

    #[test(tokio::test)]
    async fn test_crypto_info() {
        check_info("EU000A2YZK67", "Krypto").await
    }

    #[test(tokio::test)]
    async fn test_crypto_realtime() {
        check_realtime("EU000A2YZK67").await
    }

    #[test(tokio::test)]
    async fn test_crypto_historical() {
        check_historical("EU000A2YZK67").await
    }
}
