yarn build:anchor
mkdir -p .temp
mkdir -p idl
cp target/idl/drip.json ./.temp/drip.json
node scripts/postProcessIdl.js ./.temp/drip.json ./.temp/drip.out
cp ./.temp/drip.out.json ./idl/drip.json
cp ./.temp/drip.out.ts ./idl/drip.ts
rm -r ./.temp
