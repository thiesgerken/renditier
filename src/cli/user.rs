use chrono::{DateTime, NaiveDate, Utc};

use std::collections::HashMap;
use std::error::Error;
use std::io;

use crate::models::*;
use crate::*;

use diesel::prelude::*;

use prettytable::{Row, Table};

pub fn handle() {
  use crate::schema::users::dsl::*;

  if let Some(uname) = sub_matches.value_of("add") {
    // check if this username is taken
    assert!(
      users
        .filter(name.eq(uname))
        .load::<User>(&connection)
        .expect("Error loading users")
        .iter()
        .next()
        .is_none(),
      "there is already a user with name '{}'!",
      uname
    );

    let mut fname = String::new();
    println!("Please enter the full name of the new user");
    io::stdin().read_line(&mut fname).unwrap();
    let fname = fname.trim_end(); // Remove the trailing newline

    let mut password = String::new();
    println!("Please enter a password for the new user");
    io::stdin().read_line(&mut password).unwrap();
    let password = password.trim_end(); // Remove the trailing newline

    assert!(
      password.len() >= 8,
      "Password has to be at least 8 characters long!"
    );

    let mut password_repeat = String::new();
    println!("Please repeat the password");
    io::stdin().read_line(&mut password_repeat).unwrap();
    let password_repeat = password_repeat.trim_end(); // Remove the trailing newline

    assert_eq!(password, password_repeat, "Passwords do not match!");

    let u = NewUser {
      name: uname.to_string(),
      full_name: fname.to_string(),
      hash: hash_password(password),
    };

    let u: User = diesel::insert_into(stocks::schema::users::table)
      .values(&u)
      .get_result(&connection)
      .expect("Error saving new user");

    info!("Created user {:?}", u);
  } else if let Some(uname) = sub_matches.value_of("update") {
    let mut fname = String::new();
    println!("Please enter a new full name of the user");
    io::stdin().read_line(&mut fname).unwrap();
    let fname = fname.trim_end(); // Remove the trailing newline

    let mut password = String::new();
    println!("Please enter a new password for the user");
    io::stdin().read_line(&mut password).unwrap();
    let password = password.trim_end(); // Remove the trailing newline

    assert!(
      password.len() >= 8,
      "Password has to be at least 8 characters long!"
    );

    let mut password_repeat = String::new();
    println!("Please repeat the password");
    io::stdin().read_line(&mut password_repeat).unwrap();
    let password_repeat = password_repeat.trim_end(); // Remove the trailing newline

    assert_eq!(password, password_repeat, "Passwords do not match!");

    let u = diesel::update(users.filter(name.eq(uname)))
      .set((full_name.eq(fname), hash.eq(hash_password(password))))
      .get_result::<User>(&connection)
      .expect(&format!("Unable to find user {}", uname));

    info!("Updated user {:?}", u);
  } else if let Some(uname) = sub_matches.value_of("remove") {
    // check if this user even exists
    users
      .filter(name.eq(uname))
      .load::<User>(&connection)
      .expect("Error loading users")
      .iter()
      .next()
      .expect("User does not exist");

    let mut confirmation = String::new();
    println!(
          "Do you really want to delete this user? If so, enter '{}'.\n Note that this will also delete relevant accounts and transactions!",
          uname
      );
    io::stdin().read_line(&mut confirmation).unwrap();
    let confirmation = confirmation.trim_end(); // Remove the trailing newline
    assert_eq!(confirmation, uname, "Confirmation failed");

    // TODO: also delete relevant accounts and transactions

    diesel::delete(users.filter(name.eq(uname)))
      .execute(&connection)
      .expect(&format!("Unable to delete user {}", uname));

    info!("deleted user '{}'", uname);
  } else if sub_matches.is_present("list") {
    let us = users
      .load::<User>(&connection)
      .expect("Error loading users");

    let mut table = Table::new();
    table.add_row(row!["ID", "Name", "Full Name"]);

    for u in us {
      // TODO: show more details like number of transactions / accounts
      table.add_row(row![u.id, u.name, u.full_name]);
    }

    table.printstd();
  } else {
    panic!("unexpected options for subcommand 'user'");
  }
}
