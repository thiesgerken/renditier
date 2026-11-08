use crate::service::DomainError;

use chrono::NaiveDate;
use log::error;
use rocket::Request;
use rocket::http::Status;
use rocket::response::{self, Responder};
use rocket::serde::json::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct ErrString {
    pub error: String,
}

/// Only an invalid request says what went wrong. A missing or foreign resource is a bare 404, and
/// the details of an internal error go to the log, not to the caller.
impl<'r> Responder<'r, 'static> for DomainError {
    fn respond_to(self, request: &'r Request<'_>) -> response::Result<'static> {
        match self {
            DomainError::NotFound => Status::NotFound.respond_to(request),
            DomainError::Invalid(error) => {
                (Status::BadRequest, Json(ErrString { error })).respond_to(request)
            }
            DomainError::Internal(e) => {
                error!("{e}");
                Status::InternalServerError.respond_to(request)
            }
        }
    }
}

/// Query parameters take dates as strings, since rocket cannot bind a `NaiveDate`.
pub fn parse_date(date: &str) -> Result<NaiveDate, DomainError> {
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| DomainError::Invalid(format!("invalid date {date:?}, expected YYYY-MM-DD")))
}
