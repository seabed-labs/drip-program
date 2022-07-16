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

## Deploy New Program

1. Make sure to update anchor CLI `avm install 0.24.2`
2. Delete target folder
3. Build The program
4. Use `solana account ./target/deploy/drip-keypair.json` to find the pubkey
5. Update the `decalreId!` and `Anchor.toml` with the new pubkey
6. Build the program again
7. Deploy with `anchor deploy --program-name drip --provider.cluster https://api.devnet.solana.com`
8. Init IDL with `anchor idl init --provider.cluster devnet --filepath target/idl/drip.json DA34Nfa3pnwM8akcciE89LJnafVmnyGvouu7DX13Vy7v`
