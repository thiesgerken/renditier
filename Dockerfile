FROM node:24-trixie@sha256:3fdf44eb0450bddd6abb7d2991e76cebc0e16550161467143f40a98c25184e43 AS builder-frontend

RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get update -y && apt-get install -y --no-install-recommends git \
  && rm -Rf /var/cache/apt

COPY web /build/web
COPY .git /build/.git
WORKDIR /build/web

RUN npm install -g pnpm@12.15.0
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM rust:1.99-trixie@sha256:53766005847cbe02c3f59bfa49c1c4bb16695f2c9e5829c3d576a15406f5e733 AS builder-backend

RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get update -y && apt-get install -y --no-install-recommends libc-dev libssl-dev pkg-config gcc clang libclang-dev \
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

FROM debian:trixie-slim@sha256:89c1ea91e897f0fe0a3731595330bc45b8bdef4047464a07116f891a94054b31

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates libpq5 libssl3t64 poppler-utils \
  && rm -Rf /var/cache/apt

COPY --from=builder-backend /build/target/release/stockdb /bin/stockdb
CMD ["stockdb", "serve"]
