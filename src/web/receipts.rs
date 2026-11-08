use crate::models::*;
use crate::service::DomainError;
use crate::service::receipts::{self, ReceiptImport};
use crate::web::DbConn;
use crate::web::user::UserId;

use base64::Engine;
use base64::prelude::BASE64_STANDARD;
use rocket::Either;
use rocket::serde::json::Json;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct FileContents {
    pub name: String,
    pub bytes: String, // base64 encoded
}

type Booked = Json<ReceiptImport<Transaction>>;
type Preview = Json<ReceiptImport<NewTransaction>>;

/// With `preview`, nothing is booked: the response tells what would be.
#[post("/receipts?<preview>", data = "<receipts>")]
pub async fn upload(
    uid: UserId,
    connection: DbConn,
    receipts: Json<Vec<FileContents>>,
    preview: bool,
) -> Result<Either<Booked, Preview>, DomainError> {
    let files = receipts
        .0
        .into_iter()
        .map(|fc| match BASE64_STANDARD.decode(fc.bytes) {
            Ok(buf) => Ok((fc.name, buf)),
            Err(e) => Err(DomainError::Invalid(format!(
                "{}: error decoding base64: {e}",
                fc.name
            ))),
        })
        .collect::<Result<Vec<_>, _>>()?;

    connection
        .run(move |c| {
            if preview {
                receipts::preview(c, *uid, &files).map(|p| Either::Right(Json(p)))
            } else {
                receipts::import(c, *uid, &files).map(|b| Either::Left(Json(b)))
            }
        })
        .await
}
