# solana-programs

[![CI](https://github.com/dcaf-labs/drip-program/actions/workflows/ci.yml/badge.svg)](https://github.com/dcaf-labs/drip-program/actions/workflows/ci.yml)

## Deploys

[devnet - dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk](https://explorer.solana.com/address/dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk?cluster=devnet)
[mainnet - dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk](https://explorer.solana.com/address/dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk?cluster=devnet)
[devnet staging - F1NyoZsUhJzcpGyoEqpDNbUMKVvCnSXcCki1nN3ycAeo](https://explorer.solana.com/address/F1NyoZsUhJzcpGyoEqpDNbUMKVvCnSXcCki1nN3ycAeo?cluster=devnet)

## Setup Instructions

Install Rust, Solana, Anchor and Mocha - <br>
https://project-serum.github.io/anchor/getting-started/installation.html

- solana 1.10.32
- anchor 0.25.0

1. Clone repo
2. Setup nvm with node v16.13.0
3. Install typescript globally
4. `yarn install`
5. yarn run `build` to build the program

## Test

To run tests manually (from the root):

`yarn run test`

To get devnet tokens, use the webapp and self-mint.
