#! /bin/bash

docker build . -t git.thiesgerken.de:5005/thies/stockdb/ubuntu:bionic && docker push git.thiesgerken.de:5005/thies/stockdb/ubuntu:bionic
