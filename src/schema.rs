table! {
    accounts (id) {
        id -> Int4,
        user_id -> Int4,
        name -> Text,
        iban -> Nullable<Text>,
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
    push_subscriptions (endpoint) {
        endpoint -> Text,
        user_id -> Int4,
        auth -> Text,
        p256dh -> Text,
        created -> Timestamptz,
        last_contact -> Timestamptz,
        last_notification -> Nullable<Timestamptz>,
    }
}

table! {
    realtime_prices (date, onvista_record_id) {
        date -> Timestamptz,
        price -> Float8,
        onvista_record_id -> Int4,
    }
}

table! {
    stock_exchanges (onvista_record_id) {
        isin -> Bpchar,
        name -> Text,
        code -> Text,
        quality -> Nullable<Text>,
        onvista_record_id -> Int4,
        onvista_exchange_id -> Nullable<Int4>,
    }
}

table! {
    stock_infos (isin) {
        isin -> Bpchar,
        wkn -> Bpchar,
        title -> Text,
        kind -> Text,
        company -> Text,
        fonds_type -> Nullable<Text>,
        focus -> Nullable<Text>,
        persistent -> Bool,
        onvista_url -> Text,
        last_historical_update -> Nullable<Timestamptz>,
        last_realtime_update -> Nullable<Timestamptz>,
        industry_breakdown -> Nullable<Text>,
        instrument_breakdown -> Nullable<Text>,
        country_breakdown -> Nullable<Text>,
        currency_breakdown -> Nullable<Text>,
        holdings -> Nullable<Text>,
        launch_date -> Nullable<Timestamptz>,
        currency -> Nullable<Text>,
        management_type -> Nullable<Text>,
        payout_type -> Nullable<Text>,
        ter -> Nullable<Float8>,
        description -> Nullable<Text>,
        benchmark_index -> Nullable<Text>,
        instrument_id -> Nullable<Text>,
    }
}

table! {
    transactions (id) {
        id -> Int4,
        account_id -> Int4,
        isin -> Bpchar,
        date -> Timestamptz,
        units -> Float8,
        amount -> Int8,
        fees -> Int8,
        onvista_exchange_id -> Nullable<Int4>,
        comments -> Text,
        exchange -> Nullable<Text>,
        receipt_number -> Nullable<Int8>,
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
joinable!(push_subscriptions -> users (user_id));
joinable!(realtime_prices -> stock_exchanges (onvista_record_id));
joinable!(stock_exchanges -> stock_infos (isin));
joinable!(transactions -> accounts (account_id));

allow_tables_to_appear_in_same_query!(
    accounts,
    historical_prices,
    push_subscriptions,
    realtime_prices,
    stock_exchanges,
    stock_infos,
    transactions,
    users,
);
