FROM ubuntu:focal

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends git ca-certificates curl pkg-config gcc clang make libpq5 libpq-dev libc-dev libssl-dev openssh-client \
  && curl -fsSL https://deb.nodesource.com/setup_16.x | bash - \
  && apt-get install -y nodejs \
  && rm -Rf /var/cache/apt

RUN npm install --global yarn
RUN curl https://sh.rustup.rs -sSf | sh -s -- --default-toolchain stable -y

ENV PATH="/root/.cargo/bin:$PATH"
