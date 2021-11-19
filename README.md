# solana-programs
[![Test](https://github.com/Dcaf-Protocol/solana-programs/actions/workflows/test.yml/badge.svg)](https://github.com/Dcaf-Protocol/solana-programs/actions/workflows/test.yml)

## Setup Instructions

Install Rust, Solana, Anchor and Mocha - <br>
https://project-serum.github.io/anchor/getting-started/installation.html

1. Clone repo
2. Setup nvm with node v16.13.0 
3. Install typescript globally
4. `yarn install`

## Test
To run tests manually (from the root):
- cargo test
- anchor test

To run tests inside docker (from the root):
- ./scripts/test_docker_local.sh
