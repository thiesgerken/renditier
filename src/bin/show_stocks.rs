use diesel::prelude::*;
use stocks::models::*;
use stocks::*;

fn main() {
  use stocks::schema::stock_infos::dsl::*;

  let connection = establish_connection();
  run_migrations(&connection).expect("erorr running migrations");

  let results = stock_infos
    // .filter(published.eq(true))
    // .limit(5)
    .load::<StockInfo>(&connection)
    .expect("Error loading stock infos");

  println!("Displaying {} stock infos", results.len());
  for stock in results {
    println!("{}", stock.title);
    println!("----------\n");
    // println!("{}", post.body);
  }
}
