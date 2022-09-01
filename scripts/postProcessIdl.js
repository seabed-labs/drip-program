const fs = require("fs/promises");
const path = require("path");

async function main() {
  const [, , input, output] = process.argv;

  if (!input || !output) {
    console.error(
      `Usage: node scripts/postProcessIdl <input IDL file path> <output IDL file path>`
    );
    process.exit(1);
  }

  const inputIdlJson = require(path.resolve(input));

  const filteredTypes = inputIdlJson.types.filter(
    (type) =>
      !type || !type.type || !type.type.kind || type.type.kind !== "enum"
  );

  const outputIdlJson = {
    ...inputIdlJson,
    types: filteredTypes,
  };

  const modifiedAccounts = inputIdlJson.accounts.map((account) => ({
    ...account,
    name: account.name.toLowerCase(),
  }));

  const outputIdlTsJson = {
    ...outputIdlJson,
    accounts: modifiedAccounts,
  };

  await fs.writeFile(
    path.resolve(`${output}.json`),
    JSON.stringify(outputIdlJson, null, 2),
    "utf8"
  );

  await fs.writeFile(
    path.resolve(`${output}.ts`),
    `export type Drip = ${JSON.stringify(outputIdlTsJson, null, 2)};

export const IDL: Drip = ${JSON.stringify(outputIdlTsJson, null, 2)};`,
    "utf8"
  );
}

if (require.main === module) {
  main();
}
