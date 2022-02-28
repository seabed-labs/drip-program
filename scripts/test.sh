#!/bin/bash

yarn run build || exit $?
cargo test || exit $?
! anchor test | grep "failing"
