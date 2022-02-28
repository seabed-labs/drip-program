#!/bin/bash

cargo test || exit $?
! anchor test | grep "failing"
