use super::json_utils::*;
use super::{EntityType, parse_base_info};
use crate::models::StockInfo;

use serde_json::Value;
use std::error::Error;

pub fn parse_info(snapshot: &Value, breakdowns: &Value) -> Result<StockInfo, Box<dyn Error>> {
    let base_data = &snapshot["fundsBaseData"];
    let details = &snapshot["fundsDetails"];

    let title = get_string(&details["officialName"]).ok_or("error parsing title")?;
    let company =
        get_string(&snapshot["fundsIssuer"]["nameGroupIssuer"]).ok_or("error parsing company")?;
    let currency = get_string(&base_data["isoCurrencyFund"]).ok_or("error parsing currency")?;
    let info = parse_base_info(snapshot, EntityType::Fund, title, company, currency)?;

    let launch_date = get_timestamp(&base_data["dateEmission"])
        .ok_or_else(|| format!("error parsing launch date {}", base_data["dateEmission"]))?;
    let ter = get_f64(&base_data["ongoingCharges"]).ok_or("error parsing TER")?;
    let fonds_type = get_string(&details["nameTypeFund"]).ok_or("error parsing fonds_type")?;
    let focus = get_string(&details["nameInvestmentFocus"]).ok_or("error parsing focus")?;
    let payout_type = get_string(&details["fundsTypeCapitalisation"]["name"])
        .ok_or("error parsing payout_type")?;
    let description =
        get_string(&snapshot["background"][0]["value"]).ok_or("error parsing description")?;
    let benchmark = get_string(&snapshot["fundsBenchmarkList"]["list"][0]["instrument"]["name"])
        .ok_or("error parsing benchmark")?;

    let breakdown = |name: &str| {
        Some(&breakdowns[name]["list"])
            .filter(|list| list.is_array())
            .map(Value::to_string)
            .ok_or_else(|| format!("error parsing {name}"))
    };

    Ok(StockInfo {
        fonds_type: Some(fonds_type),
        focus: Some(focus),
        holdings: Some(breakdown("fundsHoldingList")?),
        industry_breakdown: Some(breakdown("branchBreakdown")?),
        instrument_breakdown: Some(breakdown("instrumentBreakdown")?),
        country_breakdown: Some(breakdown("countryBreakdown")?),
        currency_breakdown: Some(breakdown("currencyBreakdown")?),
        launch_date: Some(launch_date),
        payout_type: Some(payout_type),
        ter: Some(ter / 100.),
        description: Some(description),
        benchmark_index: Some(benchmark),
        ..info
    })
}
