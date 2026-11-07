use super::json_utils::*;
use super::{EntityType, parse_base_info};
use crate::models::StockInfo;

use serde_json::Value;
use std::error::Error;

pub fn parse_info(snapshot: &Value) -> Result<StockInfo, Box<dyn Error>> {
    let title = get_string(&snapshot["instrument"]["name"]).ok_or("error parsing title")?;
    let company =
        get_string(&snapshot["derivativesIssuer"]["name"]).ok_or("error parsing company")?;
    let currency = get_string(&snapshot["derivativesDetails"]["isoCurrency"])
        .ok_or("error parsing currency")?;

    parse_base_info(snapshot, EntityType::Derivative, title, company, currency)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::onvista::tests::fixture;

    #[test]
    fn test_parse_info() {
        let info = parse_info(&fixture("etc_snapshot")).unwrap();

        assert_eq!(info.isin, "DE000EWG2LD7");
        assert_eq!(info.wkn, "EWG2LD");
        assert_eq!(info.title, "EUWAX Gold II");
        assert_eq!(info.kind, "ETC");
        assert_eq!(info.company, "Börse Stuttgart Commodities");
        assert_eq!(info.currency.as_deref(), Some("EUR"));
        assert_eq!(
            info.onvista_url,
            "/derivate/ETCs/128897970-EWG2LD-DE000EWG2LD7"
        );
        assert_eq!(info.instrument_id.as_deref(), Some("128897970"));
        assert_eq!(info.description, None);
    }
}
