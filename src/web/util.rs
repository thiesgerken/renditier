use log::error;
use rocket::http::Status;
use std::error::Error;

pub fn log_error_and_500(e: Box<dyn Error>) -> Status {
    error!("{}", e);
    Status::InternalServerError
}
