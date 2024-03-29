# solana-programs

[![CI/CD](https://github.com/seabed-labs/drip-program/actions/workflows/ci_cd.yml/badge.svg)](https://github.com/seabed-labs/drip-program/actions/workflows/ci_cd.yml)

## Deploys

### Maintained

[mainnet - dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk](https://explorer.solana.com/address/dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk?cluster=devnet)

### Deprecated

[devnet - dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk](https://explorer.solana.com/address/dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk?cluster=devnet)
[devnet staging - F1NyoZsUhJzcpGyoEqpDNbUMKVvCnSXcCki1nN3ycAeo](https://explorer.solana.com/address/F1NyoZsUhJzcpGyoEqpDNbUMKVvCnSXcCki1nN3ycAeo?cluster=devnet)

## Setup Instructions

Install Rust, Solana, Anchor and Mocha - <br>
https://project-serum.github.io/anchor/getting-started/installation.html

- rustc 1.65.0
- solana 1.10.32
- anchor 0.25.0

1. Clone repo
2. Setup nvm with node v16.13.0
3. `yarn install`
4. `yarn run build` to build the program
5. `yarn run test` to build and run unit + integration tests
