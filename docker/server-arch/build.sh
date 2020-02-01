#! /bin/bash

docker build . -t git.thiesgerken.de:5005/thies/stockdb/server-arch && docker push git.thiesgerken.de:5005/thies/stockdb/server-arch
