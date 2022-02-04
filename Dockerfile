FROM ubuntu:focal as builder

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends git ca-certificates curl pkg-config gcc clang make libpq5 libpq-dev libc-dev libssl-dev openssh-client \
  && curl -fsSL https://deb.nodesource.com/setup_16.x | bash - \
  && apt-get install -y nodejs \
  && rm -Rf /var/cache/apt

RUN npm install --global yarn
RUN curl https://sh.rustup.rs -sSf | sh -s -- --default-toolchain stable -y

ENV PATH="/root/.cargo/bin:$PATH"

COPY . /build

WORKDIR /build/web
RUN yarn install
# RUN yarn run git && yarn test --all && yarn test:lint:js
RUN yarn run build && yarn run analyze

WORKDIR /build
RUN cargo build --target=x86_64-unknown-linux-gnu --release
RUN cp target/x86_64-unknown-linux-gnu/release/stockdb .
RUN target/x86_64-unknown-linux-gnu/release/generate --config > config-dist.toml
RUN strip -s stockdb

FROM ubuntu:focal

COPY --from=builder /build/target/x86_64-unknown-linux-gnu/release/stockdb /bin/stockdb
COPY --from=builder /build/config-dist.toml /etc/stockdb/config.toml

CMD stockdb