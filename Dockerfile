FROM node:24-trixie@sha256:9516e2220ff64c75233a3d6d8aa90f857381bc6266de5803d620b2b2dbaf9e60 AS builder-frontend

RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get update -y && apt-get install -y --no-install-recommends git \
  && rm -Rf /var/cache/apt

COPY web /build/web
COPY .git /build/.git
WORKDIR /build/web

RUN npm install -g pnpm@12.4.1
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM rust:1.98-trixie@sha256:bf5a9aa29062a6cb03c49bd59a46eb55e3cc770caf598a221a7866e500be3082 AS builder-backend

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

FROM debian:trixie-slim@sha256:d7e12182ce18b85b93007c1dedf31f2d29e01ccf3182cc4017c709b6259bc132

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates libpq5 libssl3t64 poppler-utils \
  && rm -Rf /var/cache/apt

COPY --from=builder-backend /build/target/release/stockdb /bin/stockdb
CMD ["stockdb", "serve"]
