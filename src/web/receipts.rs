use crate::models::*;
use crate::receipts;
use crate::web::user::UserId;
use crate::web::DbConn;

use rocket_contrib::json::Json;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct FileContents {
    pub name: String,
    pub bytes: String, // base64 encoded
}

#[derive(Serialize)]
pub struct ErrString {
    pub error: String,
}

fn wrap_string(e: String) -> Json<ErrString> {
    Json(ErrString { error: e })
}

#[post("/receipts", data = "<receipts>")]
pub fn upload(
    uid: UserId,
    connection: DbConn,
    receipts: Json<Vec<FileContents>>,
) -> Result<Json<Vec<Transaction>>, Json<ErrString>> {
    let files = receipts
        .0
        .into_iter()
        .map(|fc| {
            let name = fc.name;
            let buf = base64::decode(fc.bytes).map_err(|e| {
                wrap_string(format!("{}: error decoding base64: {}", name.clone(), e))
            })?;

            Ok((name, buf))
        })
        .collect::<Result<Vec<_>, Json<ErrString>>>()?;

    Ok(Json(
        receipts::parse_mem(&*connection, *uid, &files)
            .map_err(|e| wrap_string(format!("{}", e)))?,
    ))
}
