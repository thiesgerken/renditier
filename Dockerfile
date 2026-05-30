FROM node:24-bullseye@sha256:87ba72ac15b59ca7dc49c63c7ad6253b7bc15ab28fa22351f7e402f64e0c8ea9 AS builder-frontend

RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get update -y && apt-get install -y --no-install-recommends git \
  && rm -Rf /var/cache/apt

COPY web /build/web
COPY .git /build/.git
WORKDIR /build/web

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM rust:1.87-bullseye@sha256:af1a29a166198e1295ca667007e95d2e70c866e3928ba9b25f3907035581c39e AS builder-backend

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
CMD stockdb serve
