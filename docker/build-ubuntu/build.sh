#! /bin/bash

docker build . -t git.thiesgerken.de:5005/thies/stockdb/build-ubuntu && docker push git.thiesgerken.de:5005/thies/stockdb/build-ubuntu
