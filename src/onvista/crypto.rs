use super::json_utils::*;
use super::{EntityType, parse_base_info};
use crate::models::StockInfo;

use serde_json::Value;
use std::error::Error;

pub fn parse_info(snapshot: &Value) -> Result<StockInfo, Box<dyn Error>> {
    let details = &snapshot["cryptoDetails"];
    let currency = get_string(&details["isoCurrency"]).ok_or("error parsing currency")?;
    if currency != "EUR" {
        let pair = get_string(&snapshot["instrument"]["entityValue"])
            .ok_or("error parsing entity value")?;
        let coin = get_string(&details["isoCurrencyFrom"]).ok_or("error parsing coin")?;
        return Err(format!(
            "{pair} is quoted in {currency}, stockdb is EUR-only: add {coin}EUR or its ISIN instead"
        )
        .into());
    }
    let title = get_string(&snapshot["instrument"]["name"]).ok_or("error parsing title")?;

    parse_base_info(snapshot, EntityType::Crypto, title, None, currency)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::onvista::tests::fixture;

    #[test]
    fn test_parse_info() {
        let info = parse_info(&fixture("crypto_snapshot")).unwrap();

        assert_eq!(info.isin, "EU000A2YZK67");
        assert_eq!(info.wkn, "A2YZK6");
        assert_eq!(info.title, "Bitcoin");
        assert_eq!(info.kind, "Krypto");
        assert_eq!(info.company, None);
        assert_eq!(info.currency.as_deref(), Some("EUR"));
        assert_eq!(info.onvista_url, "/kryptowaehrungen/Bitcoin-BTC");
        assert_eq!(info.instrument_id.as_deref(), Some("BTCEUR"));
    }

    #[test]
    fn test_parse_info_rejects_other_currencies() {
        let error = parse_info(&fixture("crypto_usd_snapshot")).unwrap_err();

        assert_eq!(
            error.to_string(),
            "BTCUSD is quoted in USD, stockdb is EUR-only: add BTCEUR or its ISIN instead"
        );
    }
}
