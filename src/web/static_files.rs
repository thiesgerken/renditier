use rocket::http::{ContentType, Status};
use rocket::response;
use std::ffi::OsStr;
use std::io::Cursor;
use std::path::PathBuf;

#[derive(RustEmbed)]
#[folder = "web/build/"]
struct Asset;

#[get("/<file..>", rank = 0)]
pub fn serve<'r>(file: PathBuf) -> response::Result<'r> {
    let filename = file.display().to_string();

    if let Some(d) = Asset::get(&filename) {
        let caching = if filename.starts_with("static/") {
            "max-age=31536000,immutable"
        } else {
            "no-cache"
        };

        let ext = file
            .as_path()
            .extension()
            .and_then(OsStr::to_str)
            .ok_or(Status::NotFound)?;
        let content_type = ContentType::from_extension(ext).unwrap_or(ContentType::Plain);
        response::Response::build()
            .header(content_type)
            .raw_header("Cache-control", caching)
            .sized_body(None, Cursor::new(d))
            .ok()
    } else if filename != "index.html" {
        // Routing is done client-side;
        // hence, we just forward all requests that are not api calls or static files to the web app
        serve(PathBuf::from("index.html"))
    } else {
        Err(Status::NotFound)
    }
}

#[get("/")]
pub fn index<'r>() -> response::Result<'r> {
    serve(PathBuf::from("index.html"))
}
