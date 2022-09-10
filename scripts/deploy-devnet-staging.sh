# Output Keys
solana config set -u devnet
rm -rf ./upgrade-authority.json
rm -rf ./drip-keypair.json 
echo "$UPGRADE_AUTHORITY" >> "./upgrade-authority.json"
echo "$DRIP_KEYPAIR" >> "./drip-keypair.json"
PROGRAM_ID=$(solana-keygen pubkey ./drip-keypair.json)
UPGRADE_AUTH=$(solana-keygen pubkey ./upgrade-authority.json)
echo "Program ID"
echo $PROGRAM_ID
echo "Upgrade Authority"
echo $UPGRADE_AUTH
solana balance $UPGRADE_AUTH


# Replace Progrma ID 
find . -name '*.toml' -exec sed -i -e "s/dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk/$PROGRAM_ID/g" {} \;
find . -name '*.rs' -exec sed -i -e "s/dripTrkvSyQKvkyWg7oi4jmeEGMA5scSYowHArJ9Vwk/$PROGRAM_ID/g" {} \;
rm -rf **/*.rs-e
rm -rf **/*.toml-e

# Build
rm -rf ./target
yarn build
mv ./drip-keypair.json ./target/deploy/
mv idl/idl.json target/idl/drip.json
mv idl/drip.ts target/types/drip.ts

# Upgrade 
anchor upgrade --program-id ${PROGRAM_ID} --provider.cluster https://api.devnet.solana.com --provider.wallet ./upgrade-authority.json ./target/deploy/drip.so
anchor idl upgrade --provider.cluster https://api.devnet.solana.com --provider.wallet ./upgrade-authority.json --filepath target/idl/drip.json F1NyoZsUhJzcpGyoEqpDNbUMKVvCnSXcCki1nN3ycAeo
# anchor deploy --program-name drip --provider.cluster https://api.devnet.solana.com --provider.wallet ./upgrade-authority.json
# anchor idl init --provider.cluster https://api.devnet.solana.com --provider.wallet ./upgrade-authority.json --filepath target/idl/drip.json F1NyoZsUhJzcpGyoEqpDNbUMKVvCnSXcCki1nN3ycAeo