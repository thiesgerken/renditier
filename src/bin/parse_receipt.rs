use clap::{Arg, ArgAction, Command, crate_authors, crate_version};
use renditier::initialize_logging;
use renditier::receipts;

fn main() {
    let matches = Command::new("parse_receipt")
        .version(crate_version!())
        .author(crate_authors!())
        .about("Parse receipt PDFs locally without touching database")
        .arg(
            Arg::new("verbose")
                .short('v')
                .action(ArgAction::Count)
                .help("Increase logging verbosity"),
        )
        .arg(
            Arg::new("json")
                .long("json")
                .action(ArgAction::SetTrue)
                .help("Print parsed transactions as pretty JSON"),
        )
        .arg(
            Arg::new("pdftotext")
                .long("pdftotext")
                .action(ArgAction::SetTrue)
                .help("Prefer pdftotext over pdf-extract for text extraction"),
        )
        .arg(
            Arg::new("files")
                .required(true)
                .num_args(1..)
                .help("Receipt PDF files to parse"),
        )
        .get_matches();

    initialize_logging(matches.get_count("verbose") as u32);

    receipts::configure(&receipts::Config {
        prefer_pdftotext: *matches.get_one::<bool>("pdftotext").unwrap(),
    });

    let file_names = matches
        .get_many::<String>("files")
        .unwrap()
        .map(|s| s.as_str())
        .collect::<Vec<_>>();

    let parsed = receipts::parse_preview_files(&file_names)
        .unwrap_or_else(|e| panic!("Error parsing receipts: {:?}", e));

    if *matches.get_one::<bool>("json").unwrap() {
        println!(
            "{}",
            serde_json::to_string_pretty(&parsed).expect("unable to serialize parsed receipts")
        );
    } else {
        println!("{:#?}", parsed);
    }
}
