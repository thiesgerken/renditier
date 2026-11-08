//! Mounts the MCP server (`crate::mcp`) as a Rocket route. Rocket speaks http 0.2, rmcp's tower
//! service http 1, so the request is copied over by hand.

use crate::mcp::{self, Caller};
use crate::web::DbConn;
use crate::web::user::api_key_caller;

use http_body_util::BodyExt;
use rocket::State;
use rocket::data::{Data, ToByteUnit};
use rocket::http::{Header, Status};
use rocket::outcome::try_outcome;
use rocket::request::{FromRequest, Outcome, Request};
use rocket::response::{self, Responder, Response};
use std::io::Cursor;
use std::sync::Arc;

/// JSON-RPC messages are small: the largest is a transaction to book.
const MAX_BODY: u64 = 1024 * 1024;

/// What rmcp needs of the request besides its body, and the caller behind its API key.
pub struct McpRequest {
    caller: Caller,
    head: http::request::Builder,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for McpRequest {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // Keys only: a session cookie a browser sends along must not open the agents' door.
        let (user_id, access) = try_outcome!(api_key_caller(request).await);

        let mut head = http::Request::builder()
            .method(request.method().as_str())
            .uri(request.uri().to_string());
        for h in request.headers().iter() {
            head = head.header(h.name().as_str(), h.value());
        }

        Outcome::Success(McpRequest {
            caller: Caller { user_id, access },
            head,
        })
    }
}

pub struct McpResponse(http::Response<Vec<u8>>);

impl<'r> Responder<'r, 'static> for McpResponse {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'static> {
        let (parts, body) = self.0.into_parts();
        let mut response = Response::build();
        response
            .status(Status::new(parts.status.as_u16()))
            .sized_body(body.len(), Cursor::new(body));
        for (name, value) in &parts.headers {
            let value = value.to_str().map_err(|_| Status::InternalServerError)?;
            response.raw_header_adjoin(name.as_str().to_owned(), value.to_owned());
        }

        response.ok()
    }
}

#[post("/mcp", data = "<body>")]
pub async fn post(
    request: McpRequest,
    connection: DbConn,
    service: &State<mcp::Service>,
    body: Data<'_>,
) -> Result<McpResponse, Status> {
    let body = body
        .open(MAX_BODY.bytes())
        .into_string()
        .await
        .map_err(|_| Status::BadRequest)?;
    if !body.is_complete() {
        return Err(Status::PayloadTooLarge);
    }

    let request = request
        .head
        .extension(request.caller)
        .extension(Arc::new(connection))
        .body(body.into_inner())
        .map_err(|_| Status::BadRequest)?;

    let (parts, body) = service.handle(request).await.into_parts();
    let body = body
        .collect()
        .await
        .expect("rmcp's response body cannot fail")
        .to_bytes()
        .to_vec();

    Ok(McpResponse(http::Response::from_parts(parts, body)))
}

#[derive(Responder)]
#[response(status = 405)]
pub struct MethodNotAllowed {
    body: (),
    allow: Header<'static>,
}

/// Stateless: there is no session whose server-sent events a GET could subscribe to.
#[get("/mcp")]
pub fn get() -> MethodNotAllowed {
    MethodNotAllowed {
        body: (),
        allow: Header::new("Allow", "POST"),
    }
}
