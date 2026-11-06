use super::json_utils::*;
use super::{get_instrument_json, parse_base_info, EntityType};
use crate::models::StockInfo;

use serde_json::Value;
use std::error::Error;

pub async fn parse_info(snapshot: &Value) -> Result<StockInfo, Box<dyn Error>> {
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

    let breakdowns = get_instrument_json(EntityType::Fund, &info.isin, "breakdowns").await?;

    Ok(StockInfo {
        fonds_type: Some(fonds_type),
        focus: Some(focus),
        holdings: Some(breakdowns["fundsHoldingList"]["list"].to_string()),
        industry_breakdown: Some(breakdowns["branchBreakdown"]["list"].to_string()),
        instrument_breakdown: Some(breakdowns["instrumentBreakdown"]["list"].to_string()),
        country_breakdown: Some(breakdowns["countryBreakdown"]["list"].to_string()),
        currency_breakdown: Some(breakdowns["currencyBreakdown"]["list"].to_string()),
        launch_date: Some(launch_date),
        payout_type: Some(payout_type),
        ter: Some(ter / 100.),
        description: Some(description),
        benchmark_index: Some(benchmark),
        ..info
    })
}
