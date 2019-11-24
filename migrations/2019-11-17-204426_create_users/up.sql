CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, 
  full_name TEXT NOT NULL,
  password TEXT NOT NULL, 
  salt TEXT NOT NULL
)
