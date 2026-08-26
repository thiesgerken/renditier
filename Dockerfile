FROM node:24-trixie@sha256:e159cf9a61669d94101de6652d40226423bf24dd7929ec2df0a504b6d3714855 AS builder-frontend

RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get update -y && apt-get install -y --no-install-recommends git \
  && rm -Rf /var/cache/apt

COPY web /build/web
COPY .git /build/.git
WORKDIR /build/web

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
RUN pnpm install --frozen-lockfile
RUN pnpm run build

FROM rust:1.98-trixie@sha256:271849e998ffce5776454bbf98c5dc21baafc854ff8e566197908d3aca9a81e8 AS builder-backend

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
