use crate::data::exchange_comparison;
use crate::models::*;
use crate::schema::*;
use crate::service::DomainError;

use chrono::NaiveDate;
use diesel::prelude::*;

/// The closing prices of one exchange listing (`record`), oldest first. `from` and `to` are
/// inclusive.
pub fn historical(
    c: &mut PgConnection,
    record: i32,
    from: Option<NaiveDate>,
    to: Option<NaiveDate>,
    offset: Option<i64>,
    count: Option<i64>,
) -> Result<Vec<HistoricalPrice>, DomainError> {
    let mut query = historical_prices::table
        .filter(historical_prices::onvista_record_id.eq(record))
        .into_boxed();

    if let Some(from) = from {
        query = query.filter(historical_prices::date.ge(from));
    }
    if let Some(to) = to {
        query = query.filter(historical_prices::date.le(to));
    }

    Ok(query
        .order(historical_prices::date.asc())
        .limit(count.unwrap_or(i64::MAX))
        .offset(offset.unwrap_or(0))
        .load(c)?)
}

/// The closing prices of `isin` from `from` to `to` (inclusive), from the most preferred exchange
/// that has any in that range. `None` when none has.
pub fn history(
    c: &mut PgConnection,
    isin: &str,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<Option<(StockExchange, Vec<HistoricalPrice>)>, DomainError> {
    let isin = isin.to_uppercase();
    stock_infos::table
        .find(&isin)
        .select(stock_infos::isin)
        .first::<String>(c)?;

    let mut exchanges = stock_exchanges::table
        .filter(stock_exchanges::isin.eq(&isin))
        .load::<StockExchange>(c)?;
    exchanges.sort_by(exchange_comparison);

    for exchange in exchanges {
        let prices = historical(
            c,
            exchange.onvista_record_id,
            Some(from),
            Some(to),
            None,
            None,
        )?;
        if !prices.is_empty() {
            return Ok(Some((exchange, prices)));
        }
    }

    Ok(None)
}
