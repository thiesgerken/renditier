# note that this image expects the stockdb executable to be built and be present in the current directory,
# e.g. after a run of the CI build pipeline.

FROM ubuntu:focal

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -y && apt-get dist-upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates libpq5 libssl1.1 curl \
  && rm -Rf /var/cache/apt

HEALTHCHECK --interval=60s --timeout=15s CMD curl -f http://localhost:$STOCKDB__WEB__PORT -v -o /dev/null || exit 1
COPY ./stockdb /bin/stockdb
CMD stockdb
