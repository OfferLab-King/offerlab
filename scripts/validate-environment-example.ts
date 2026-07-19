import { readFile } from "node:fs/promises";

import { environmentKeys } from "../src/infrastructure/config/environment";

const content = await readFile(".env.example", "utf8");
const entries = content
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => line.split("=", 2));

const invalidValues = entries.filter((entry) => entry[1] !== "");
if (invalidValues.length > 0) {
  throw new Error(".env.example must contain names only, with empty values.");
}

const actualKeys = entries.map(([key]) => key).sort();
const expectedKeys = [...environmentKeys].sort();

if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
  throw new Error(
    `.env.example keys do not match the configuration schema. Expected: ${expectedKeys.join(", ")}`,
  );
}

process.stdout.write(
  "Environment example matches the configuration schema and contains no values.\n",
);
