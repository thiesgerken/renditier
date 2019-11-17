table! {
    historical_prices (date, onvista_record_id) {
        date -> Date,
        opening -> Float8,
        closing -> Float8,
        high -> Float8,
        low -> Float8,
        volume -> Int4,
        onvista_record_id -> Int4,
    }
}

table! {
    realtime_prices (date, onvista_record_id) {
        date -> Timestamptz,
        price -> Float8,
        currency -> Nullable<Text>,
        onvista_record_id -> Int4,
    }
}

table! {
    stock_exchanges (onvista_record_id) {
        isin -> Bpchar,
        name -> Text,
        code -> Text,
        quality -> Text,
        onvista_record_id -> Int4,
        onvista_exchange_id -> Int4,
    }
}

table! {
    stock_infos (isin) {
        isin -> Bpchar,
        wkn -> Bpchar,
        title -> Text,
        country -> Text,
        fonds_type -> Text,
        managing_company -> Text,
        focus -> Text,
        onvista_url -> Text,
        last_historical_update -> Nullable<Timestamptz>,
        last_realtime_update -> Nullable<Timestamptz>,
    }
}

allow_tables_to_appear_in_same_query!(
    historical_prices,
    realtime_prices,
    stock_exchanges,
    stock_infos,
);
