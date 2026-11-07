use super::json_utils::*;
use super::{EntityType, parse_base_info};
use crate::models::StockInfo;

use serde_json::Value;
use std::error::Error;

pub fn parse_info(snapshot: &Value, company_snapshot: &Value) -> Result<StockInfo, Box<dyn Error>> {
    let title = get_string(&snapshot["stocksDetails"]["shortName"]).ok_or("error parsing title")?;
    let company = get_string(&snapshot["company"]["name"]).ok_or("error parsing company")?;
    let currency =
        get_string(&snapshot["stocksFigure"]["isoCurrency"]).ok_or("error parsing currency")?;
    let info = parse_base_info(snapshot, EntityType::Stock, title, Some(company), currency)?;
    let description =
        get_string(&company_snapshot["profile"][0]["value"]).ok_or("error parsing description")?;

    Ok(StockInfo {
        description: Some(description),
        ..info
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::onvista::tests::fixture;

    #[test]
    fn test_parse_info() {
        let info = parse_info(
            &fixture("stock_snapshot"),
            &fixture("stock_company_snapshot"),
        )
        .unwrap();

        assert_eq!(info.isin, "DE0007164600");
        assert_eq!(info.wkn, "716460");
        assert_eq!(info.title, "SAP SE");
        assert_eq!(info.kind, "Aktie");
        assert_eq!(info.company.as_deref(), Some("SAP SE"));
        assert_eq!(info.currency.as_deref(), Some("EUR"));
        assert_eq!(info.onvista_url, "/aktien/SAP-Aktie-DE0007164600");
        assert_eq!(info.instrument_id.as_deref(), Some("82849"));
        assert!(info.description.unwrap().starts_with("Die SAP AG"));
        assert_eq!(info.fonds_type, None);
        assert_eq!(info.ter, None);
    }
}
