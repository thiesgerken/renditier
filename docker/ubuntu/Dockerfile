FROM ubuntu:bionic

RUN apt-get update -y && apt-get dist-upgrade -y && apt-get install -y --no-install-recommends git gcc make curl pkg-config libpq5 libpq-dev ca-certificates
RUN curl https://sh.rustup.rs -sSf | sh -s -- --default-toolchain nightly -y