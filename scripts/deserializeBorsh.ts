import { BorshEventCoder } from "@coral-xyz/anchor";
import { IDL } from "../target/types/drip";

// Call With: yarn run ts-node ./scripts/deserializeBorsh.ts YLjF84sCWpQFAAAAAAAAAAUAAABoZWxsbw==
const messages = process.argv.slice(2);
console.log(`deserializing ${messages.length} message(s)`);
function deserialize(encodedData: string) {
  const encoder = new BorshEventCoder(IDL);
  const decodedData = encoder.decode(encodedData);
  console.log(decodedData);
}
messages.forEach((message) => {
  deserialize(message);
});
