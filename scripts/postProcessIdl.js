const fs = require("fs/promises");

async function main() {
  const [, , input, output] = process.argv;

  if (!input || !output) {
    console.error(
      `Usage: node scripts/postProcessIdl <input IDL file path> <output IDL file path>`
    );
    process.exit(1);
  }

  const inputIdlJson = require(input);

  const filteredTypes = inputIdlJson.types.filter(
    (type) =>
      !type || !type.type || !type.type.kind || type.type.kind !== "enum"
  );

  const outputIdlJson = {
    ...inputIdlJson,
    types: filteredTypes,
  };

  await fs.writeFile(output, JSON.stringify(outputIdlJson, null, 2), "utf8");
}

if (require.main === module) {
  main();
}
