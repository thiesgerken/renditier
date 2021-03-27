use chrono::{DateTime, Utc};
use serde_json::Value;

pub fn get_f64(x: &Value) -> Option<f64> {
    if let Value::Number(x) = x {
        x.as_f64()
    } else {
        None
    }
}

pub fn get_i64(x: &Value) -> Option<i64> {
    if let Value::Number(x) = x {
        x.as_i64()
    } else {
        None
    }
}

pub fn get_string(x: &Value) -> Option<String> {
    if let Value::String(x) = x {
        Some(x.clone())
    } else {
        None
    }
}

pub fn get_array(x: &Value) -> Option<&Vec<Value>> {
    if let Value::Array(x) = x {
        Some(x)
    } else {
        None
    }
}

pub fn get_timestamp(x: &Value) -> Option<DateTime<Utc>> {
    get_string(x).and_then(|mut d| {
        // date has the time zone as +0000, which chrono cannot parse
        if d.ends_with("+0000") {
            d.insert(d.len() - 2, ':');
        }

        DateTime::parse_from_rfc3339(&d)
            .ok()
            .map(|d| d.with_timezone(&Utc))
    })
}
