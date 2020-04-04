use crate::data::exchange_comparison;
use crate::models::*;
use crate::schema::*;

use chrono::offset::TimeZone;
use chrono::{DateTime, Duration, Local, Utc};
use diesel::prelude::*;
use log::debug;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;

#[derive(Deserialize, Serialize, Clone)]
pub struct DataSource<T> {
    pub price: T,
    pub exchange: StockExchange,
}

pub type PriceMap<T> = HashMap<String, DataSource<T>>;

pub trait Price {
    // hard_threshold: amount of hours the price may be off
    // soft_threshold: amount of hours that are considered irrelevant to scoring of exchanges
    fn find_multiple(
        connection: &diesel::PgConnection,
        isins: &[String],
        dates: &[DateTime<Utc>],
        hard_threshold: i64,
        soft_threshold: i64,
    ) -> Result<Vec<PriceMap<Self>>, Box<dyn Error>>
    where
        Self: Sized;

    fn value(&self) -> f64;
    fn date(&self) -> DateTime<Utc>;
    fn onvista_record_id(&self) -> i32;
}

pub fn find<T>(
    connection: &diesel::PgConnection,
    isins: &[String],
    date: DateTime<Utc>,
    hard_threshold: i64,
    soft_threshold: i64,
) -> Result<PriceMap<T>, Box<dyn Error>>
where
    T: Price + Sized,
{
    Ok(
        Price::find_multiple(connection, isins, &[date], hard_threshold, soft_threshold)?
            .pop()
            .ok_or("find_multiple returned empty list")?,
    )
}

impl Price for RealtimePrice {
    fn value(&self) -> f64 {
        self.price
    }

    fn date(&self) -> DateTime<Utc> {
        self.date
    }

    fn onvista_record_id(&self) -> i32 {
        self.onvista_record_id
    }

    fn find_multiple(
        connection: &diesel::PgConnection,
        isins: &[String],
        dates: &[DateTime<Utc>],
        hard_threshold: i64,
        soft_threshold: i64,
    ) -> Result<Vec<PriceMap<Self>>, Box<dyn Error>> {
        let hard_lbs = dates
            .iter()
            .map(|d| {
                d.checked_sub_signed(Duration::hours(hard_threshold))
                    .unwrap()
            })
            .collect::<Vec<_>>();

        let soft_lbs = dates.iter().map(|d| {
            d.checked_sub_signed(Duration::hours(soft_threshold))
                .unwrap()
        });

        type MyJoinOn = diesel::query_source::joins::JoinOn<
            diesel::query_source::joins::Join<
                realtime_prices::table,
                stock_exchanges::table,
                diesel::query_source::joins::Inner,
            >,
            diesel::expression::operators::Eq<
                realtime_prices::columns::onvista_record_id,
                stock_exchanges::columns::onvista_record_id,
            >,
        >;

        let always_false = Box::new(realtime_prices::date.ne(realtime_prices::date));
        let fs: Box<
            dyn diesel::BoxableExpression<
                MyJoinOn,
                diesel::pg::Pg,
                SqlType = diesel::sql_types::Bool,
            >,
        > = hard_lbs
            .iter()
            .zip(dates.iter())
            .map(|(hard_lb, date)| {
                realtime_prices::date
                    .le(date)
                    .and(realtime_prices::date.ge(hard_lb))
            })
            .fold(always_false, |accum, x| Box::new(accum.or(x)));

        use std::time::Instant;
        let t_sql = Instant::now();

        let ps = realtime_prices::table
            .inner_join(
                stock_exchanges::table
                    .on(realtime_prices::onvista_record_id.eq(stock_exchanges::onvista_record_id)),
            )
            .filter(fs)
            .filter(stock_exchanges::isin.eq_any(isins))
            .order(realtime_prices::date.desc())
            .load::<(RealtimePrice, StockExchange)>(connection)?;

        debug!(
            "load_multiple: loaded {} realtime prices in {} µs",
            ps.len(),
            t_sql.elapsed().as_micros()
        );

        Ok(soft_lbs
            .zip(hard_lbs.into_iter())
            .zip(dates)
            .map(|((soft_lb, hard_lb), date)| {
                let mut res = HashMap::new();
                for isin in isins {
                    let mut hard = ps
                        .iter()
                        .filter(|(p, se)| p.date <= *date && p.date >= hard_lb && &se.isin == isin);
                    let mut soft = ps
                        .iter()
                        .filter(|(p, se)| p.date <= *date && p.date >= soft_lb && &se.isin == isin)
                        .collect::<Vec<_>>();
                    soft.sort_by(|(_, se1), (_, se2)| exchange_comparison(se1, se2));

                    if let Some((p, se)) = soft.first().copied().or_else(|| hard.next()) {
                        res.insert(
                            isin.clone(),
                            DataSource {
                                price: p.clone(),
                                exchange: se.clone(),
                            },
                        );
                    }
                }

                res
            })
            .collect::<Vec<_>>())
    }
}

impl Price for HistoricalPrice {
    fn value(&self) -> f64 {
        self.closing
    }

    fn onvista_record_id(&self) -> i32 {
        self.onvista_record_id
    }

    fn date(&self) -> DateTime<Utc> {
        // does not have to be exact
        let d = self.date.and_hms(18, 0, 0);

        chrono::Local
            .from_local_datetime(&d)
            .earliest()
            .unwrap_or_else(|| chrono::Local.from_utc_datetime(&d))
            .with_timezone(&Utc)
    }

    fn find_multiple(
        connection: &diesel::PgConnection,
        isins: &[String],
        dates: &[DateTime<Utc>],
        hard_threshold: i64,
        soft_threshold: i64,
    ) -> Result<Vec<PriceMap<Self>>, Box<dyn Error>> {
        let hard_lbs = dates
            .iter()
            .map(|d| {
                d.checked_sub_signed(Duration::hours(hard_threshold))
                    .unwrap()
                    .with_timezone(&Local)
                    .naive_local()
                    .date()
            })
            .collect::<Vec<_>>();

        let soft_lbs = dates.iter().map(|d| {
            d.checked_sub_signed(Duration::hours(soft_threshold))
                .unwrap()
                .with_timezone(&Local)
                .naive_local()
                .date()
        });

        let days = dates
            .iter()
            .map(|d| d.with_timezone(&Local).naive_local().date())
            .collect::<Vec<_>>();

        type MyJoinOn = diesel::query_source::joins::JoinOn<
            diesel::query_source::joins::Join<
                historical_prices::table,
                stock_exchanges::table,
                diesel::query_source::joins::Inner,
            >,
            diesel::expression::operators::Eq<
                historical_prices::columns::onvista_record_id,
                stock_exchanges::columns::onvista_record_id,
            >,
        >;

        let always_false = Box::new(historical_prices::date.ne(historical_prices::date));
        let fs: Box<
            dyn diesel::BoxableExpression<
                MyJoinOn,
                diesel::pg::Pg,
                SqlType = diesel::sql_types::Bool,
            >,
        > = hard_lbs
            .iter()
            .zip(days.iter())
            .map(|(hard_lb, day)| {
                historical_prices::date
                    .le(day)
                    .and(historical_prices::date.ge(hard_lb))
            })
            .fold(always_false, |accum, x| Box::new(accum.or(x)));

        use std::time::Instant;
        let t_sql = Instant::now();
        let ps =
            historical_prices::table
                .inner_join(stock_exchanges::table.on(
                    historical_prices::onvista_record_id.eq(stock_exchanges::onvista_record_id),
                ))
                .filter(fs)
                .filter(stock_exchanges::isin.eq_any(isins))
                .order(historical_prices::date.desc())
                .load::<(HistoricalPrice, StockExchange)>(connection)?;

        debug!(
            "load_multiple: loaded {} historical prices in {} µs",
            ps.len(),
            t_sql.elapsed().as_micros()
        );

        Ok(soft_lbs
            .zip(hard_lbs.into_iter())
            .zip(days)
            .map(|((soft_lb, hard_lb), day)| {
                let mut res = HashMap::new();
                for isin in isins {
                    let mut hard = ps
                        .iter()
                        .filter(|(p, se)| p.date <= day && p.date >= hard_lb && &se.isin == isin);
                    let mut soft = ps
                        .iter()
                        .filter(|(p, se)| p.date <= day && p.date >= soft_lb && &se.isin == isin)
                        .collect::<Vec<_>>();
                    soft.sort_by(|(_, se1), (_, se2)| exchange_comparison(se1, se2));

                    if let Some((p, se)) = soft.first().copied().or_else(|| hard.next()) {
                        res.insert(
                            isin.clone(),
                            DataSource {
                                price: p.clone(),
                                exchange: se.clone(),
                            },
                        );
                    }
                }

                res
            })
            .collect::<Vec<_>>())
    }
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(tag = "type")]
pub enum EitherPrice {
    RealtimePrice(RealtimePrice),
    HistoricalPrice(HistoricalPrice),
    HistoricalPriceOpening(HistoricalPrice),
}

impl EitherPrice {
    pub fn wrap_realtime(d: DataSource<RealtimePrice>) -> DataSource<EitherPrice> {
        DataSource {
            price: EitherPrice::RealtimePrice(d.price),
            exchange: d.exchange,
        }
    }

    pub fn wrap_historical(d: DataSource<HistoricalPrice>) -> DataSource<EitherPrice> {
        DataSource {
            price: EitherPrice::HistoricalPrice(d.price),
            exchange: d.exchange,
        }
    }

    pub fn value(&self) -> f64 {
        match self {
            EitherPrice::RealtimePrice(p) => p.value(),
            EitherPrice::HistoricalPrice(p) => p.closing,
            EitherPrice::HistoricalPriceOpening(p) => p.opening,
        }
    }
    pub fn date(&self) -> DateTime<Utc> {
        match self {
            EitherPrice::RealtimePrice(p) => p.date(),
            EitherPrice::HistoricalPrice(p) => p.date(),
            EitherPrice::HistoricalPriceOpening(p) => chrono::Local
                .from_local_datetime(&p.date.and_hms(9, 0, 0))
                .earliest()
                .unwrap_or_else(|| chrono::Local.from_utc_datetime(&p.date.and_hms(9, 0, 0)))
                .with_timezone(&Utc),
        }
    }

    pub fn onvista_record_id(&self) -> i32 {
        match self {
            EitherPrice::RealtimePrice(p) => p.onvista_record_id(),
            EitherPrice::HistoricalPrice(p) => p.onvista_record_id(),
            EitherPrice::HistoricalPriceOpening(p) => p.onvista_record_id(),
        }
    }
}
