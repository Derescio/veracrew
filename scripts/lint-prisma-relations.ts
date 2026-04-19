import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(resolve("prisma/schema.prisma"), "utf-8");
const relationLines = schema
  .split("\n")
  .filter((line) => line.includes("@relation") && !line.trim().startsWith("//"));

const failures = relationLines.filter((line) => !line.includes("onDelete:"));

if (failures.length > 0) {
  console.error("ERROR: These @relation declarations are missing onDelete:");
  failures.forEach((line) => console.error(`  ${line.trim()}`));
  process.exit(1);
}

console.log(`✓ All ${relationLines.length} @relation declarations have onDelete.`);
