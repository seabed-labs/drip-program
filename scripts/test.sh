#!/bin/bash

cargo test || exit $?
anchor test || exit $?

echo $?
