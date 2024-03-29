yarn build:anchor
mkdir -p .temp
mkdir -p idl
cp target/idl/drip.json ./.temp/drip.json
node scripts/postProcessIdl.js ./.temp/drip.json ./.temp/drip.out
yarn run prettier --w ./.temp/
cp ./.temp/drip.out.json ./idl/idl.json
cp ./.temp/drip.out.ts ./idl/drip.ts
rm -r ./.temp
