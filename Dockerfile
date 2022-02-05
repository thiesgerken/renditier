FROM ubuntu:focal as builder

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends git ca-certificates curl pkg-config gcc clang make libpq5 libpq-dev libc-dev libssl-dev \
  && curl -fsSL https://deb.nodesource.com/setup_16.x | bash - \
  && apt-get install -y nodejs \
  && rm -Rf /var/cache/apt

RUN npm install --global yarn
RUN curl https://sh.rustup.rs -sSf | sh -s -- --default-toolchain stable -y

ENV PATH="/root/.cargo/bin:$PATH"

COPY . /build

WORKDIR /build/web
RUN yarn install
RUN yarn run build

WORKDIR /build
RUN cargo build --target=x86_64-unknown-linux-gnu --release
RUN strip -s target/x86_64-unknown-linux-gnu/release/stockdb

FROM ubuntu:focal

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates libpq5 libssl1.1 \
  && rm -Rf /var/cache/apt

COPY --from=builder /build/target/x86_64-unknown-linux-gnu/release/stockdb /bin/stockdb
CMD stockdb
