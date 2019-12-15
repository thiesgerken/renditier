table! {
    accounts (id) {
        id -> Int4,
        user_id -> Int4,
        broker -> Text,
        iban -> Text,
    }
}

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
        currency -> Text,
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
        persistent -> Bool,
        onvista_url -> Text,
        last_historical_update -> Nullable<Timestamptz>,
        last_realtime_update -> Nullable<Timestamptz>,
    }
}

table! {
    transactions (id) {
        id -> Int4,
        account_id -> Int4,
        isin -> Bpchar,
        date -> Timestamptz,
        units -> Float8,
        amount -> Money,
        fees -> Money,
        onvista_exchange_id -> Int4,
    }
}

table! {
    users (id) {
        id -> Int4,
        name -> Text,
        full_name -> Text,
        hash -> Text,
    }
}

joinable!(accounts -> users (user_id));
joinable!(historical_prices -> stock_exchanges (onvista_record_id));
joinable!(realtime_prices -> stock_exchanges (onvista_record_id));
joinable!(stock_exchanges -> stock_infos (isin));
joinable!(transactions -> accounts (account_id));

allow_tables_to_appear_in_same_query!(
    accounts,
    historical_prices,
    realtime_prices,
    stock_exchanges,
    stock_infos,
    transactions,
    users,
);
