#! /bin/bash

docker build . -t git.thiesgerken.de:5005/thies/stockdb/package && docker push git.thiesgerken.de:5005/thies/stockdb/package
