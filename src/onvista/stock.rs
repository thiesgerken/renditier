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
    let info = parse_base_info(snapshot, EntityType::Stock, title, company, currency)?;
    let description =
        get_string(&company_snapshot["profile"][0]["value"]).ok_or("error parsing description")?;

    Ok(StockInfo {
        description: Some(description),
        ..info
    })
}
