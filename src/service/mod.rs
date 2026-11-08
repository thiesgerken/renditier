//! The domain logic behind every user-facing interface (REST, MCP, CLI). Functions take the
//! caller's `user_id` and enforce ownership themselves, so an adapter cannot forget to.

pub mod accounts;
pub mod analysis;
pub mod prices;
pub mod receipts;
pub mod stocks;
pub mod transactions;

use std::error::Error;
use std::fmt;

#[derive(Debug, PartialEq)]
pub enum DomainError {
    /// Missing, or owned by another user: callers must not be able to tell the two apart.
    NotFound,
    /// The request itself is wrong. The message says how and is meant for the caller.
    Invalid(String),
    /// Anything else, e.g. the database failing. The message is meant for the log.
    Internal(String),
}

impl fmt::Display for DomainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DomainError::NotFound => write!(f, "not found"),
            DomainError::Invalid(e) => write!(f, "invalid request: {e}"),
            DomainError::Internal(e) => write!(f, "internal error: {e}"),
        }
    }
}

impl Error for DomainError {}

impl From<diesel::result::Error> for DomainError {
    fn from(e: diesel::result::Error) -> Self {
        match e {
            diesel::result::Error::NotFound => DomainError::NotFound,
            e => DomainError::Internal(e.to_string()),
        }
    }
}

/// The analysis functions report every failure the same way, and none of them is the caller's.
impl From<Box<dyn Error>> for DomainError {
    fn from(e: Box<dyn Error>) -> Self {
        DomainError::Internal(e.to_string())
    }
}
