# solana-programs

[![Build + Tests](https://github.com/Dcaf-Protocol/solana-programs/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/Dcaf-Protocol/solana-programs/actions/workflows/build-and-test.yml)

## Setup Instructions

Install Rust, Solana, Anchor and Mocha - <br>
https://project-serum.github.io/anchor/getting-started/installation.html

- solana 1.8.5
- anchor 0.22.0

1. Clone repo
   1. git submodule update --recursive --remote
2. Setup nvm with node v16.13.0
3. Install typescript globally
4. `yarn install`
5. yarn run `build-deps` to build dependent programs

## Test

To run tests manually (from the root):

- cargo test
- anchor test

To run tests inside docker (from the root):

- ./scripts/test_docker_local.sh
