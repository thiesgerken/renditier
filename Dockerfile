FROM node:16-bullseye@sha256:cd59a61258b82b86c1ff0ead50c8a689f6c3483c5ed21036e11ee741add419eb AS builder-frontend

RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get update -y && apt-get install -y --no-install-recommends git \
  && rm -Rf /var/cache/apt

COPY web /build/web
COPY .git /build/.git
WORKDIR /build/web

RUN yarn install
RUN yarn run build

FROM rust:1.81-bullseye@sha256:8328d21407009f8a2d17b0327f32c63411a8c3d5590b71ab87ea993cd2ffd169 AS builder-backend

RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get update -y && apt-get install -y --no-install-recommends libc-dev libssl-dev pkg-config gcc clang \
  && rm -Rf /var/cache/apt

WORKDIR /build

COPY Cargo.toml .
COPY Cargo.lock .
RUN mkdir -p src/bin && touch src/lib.rs && touch src/bin/stockdb.rs && touch src/bin/sandbox.rs && touch src/bin/generate.rs && cargo build --lib --release

COPY --from=builder-frontend /build/web/build ./web/build

COPY src ./src
COPY migrations ./migrations

RUN touch src/lib.rs && touch src/bin/stockdb.rs && touch src/bin/sandbox.rs && touch src/bin/generate.rs
RUN cargo build --release
RUN strip -s target/release/stockdb

FROM debian:bullseye-slim@sha256:849d9d34d5fe0bf88b5fb3d09eb9684909ac4210488b52f4f7bbe683eedcb851

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates libpq5 libssl1.1 \
  && rm -Rf /var/cache/apt

COPY --from=builder-backend /build/target/release/stockdb /bin/stockdb
CMD stockdb
