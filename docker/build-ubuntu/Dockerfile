FROM ubuntu:focal

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates curl pkg-config gcc clang make libpq5 libpq-dev libc-dev libssl-dev openssh-client \
  && rm -Rf /var/cache/apt

RUN curl https://sh.rustup.rs -sSf | sh -s -- --default-toolchain stable -y
# RUN curl https://sh.rustup.rs -sSf | sh -s -- --default-toolchain nightly -y

ENV PATH="/root/.cargo/bin:$PATH"
