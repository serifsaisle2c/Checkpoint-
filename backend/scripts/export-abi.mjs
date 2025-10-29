import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const artifactPath = resolve("./artifacts/contracts/EncryptedCheckIn.sol/EncryptedCheckIn.json");
const outDir = resolve("../frontend/src/abi");
const outABI = resolve(outDir + "/EncryptedCheckInABI.ts");
const outAddr = resolve(outDir + "/EncryptedCheckInAddresses.ts");

mkdirSync(outDir, { recursive: true });

const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

const abiTs = `export const EncryptedCheckInABI = ${JSON.stringify({ abi: artifact.abi }, null, 2)} as const;`;
writeFileSync(outABI, abiTs);

// Load previous addresses if present (to preserve known mappings like 11155111)
const previous = (() => {
  try {
    const content = readFileSync(outAddr, "utf8");
    const matches = [...content.matchAll(/"(\d+)":\s*\{\s*"address":\s*"([^"]*)"\s*\}/g)];
    const acc = {};
    for (const m of matches) acc[m[1]] = { address: m[2] };
    return acc;
  } catch {
    return {};
  }
})();

// Load deployments if present and override previous values
let deployments = { ...previous };
try {
  const d = JSON.parse(readFileSync(resolve("./deployments/localhost/EncryptedCheckIn.json"), "utf8"));
  deployments["31337"] = { address: d.address };
} catch {}
try {
  const d = JSON.parse(readFileSync(resolve("./deployments/sepolia/EncryptedCheckIn.json"), "utf8"));
  deployments["11155111"] = { address: d.address };
} catch {}

// Ensure both 31337 (local) and 11155111 (sepolia) keys exist
if (!deployments["31337"]) deployments["31337"] = { address: "" };
if (!deployments["11155111"]) deployments["11155111"] = { address: "" };

const addrTs = `export const EncryptedCheckInAddresses = ${JSON.stringify(deployments, null, 2)} as const;`;
writeFileSync(outAddr, addrTs);

console.log("ABI and addresses exported to", dirname(outABI));


