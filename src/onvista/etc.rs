use super::json_utils::*;
use super::{parse_base_info, EntityType};
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
