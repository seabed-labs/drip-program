#!/bin/bash


docker-compose --file ./build/githubactions/docker-compose.yaml up -d --build
docker exec githubactions_test_1 bash ./scripts/test.sh
echo $?
docker-compose --file ./build/githubactions/docker-compose.yaml down
