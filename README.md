# solana-programs

[![Build + Tests](https://github.com/Dcaf-Protocol/solana-programs/actions/workflows/build-and-test.yml/badge.svg)](https://github.com/Dcaf-Protocol/solana-programs/actions/workflows/build-and-test.yml)

## Setup Instructions

Install Rust, Solana, Anchor and Mocha - <br>
https://project-serum.github.io/anchor/getting-started/installation.html

- solana 1.10.5
- anchor 0.24.2

1. Clone repo
   1. git submodule update --recursive --remote
2. Setup nvm with node v16.13.0
3. Install typescript globally
4. `yarn install`
5. yarn run `build` to build the program

## Test

To run tests manually (from the root):

`yarn run test`

## Devnet

Run the setup script `yarn setup:dev`, this
will deploy a vaults for 3 tokens (6 pairs) with a variety of
granularities.

To get devnet tokens, use the webapp and self-mint.
