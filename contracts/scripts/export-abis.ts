import * as fs from "fs";
import * as path from "path";

/**
 * Script to export contract ABIs from Hardhat artifacts to exports/abis/ directory.
 * 
 * Extracts only the ABI array from each contract artifact and writes clean JSON files
 * for easy consumption by backend and frontend services.
 * 
 * This script can run standalone or be chained with other export scripts.
 */
async function main() {
  const contractsDir = path.join(__dirname, "..");
  const artifactsDir = path.join(contractsDir, "artifacts", "contracts");
  const exportsDir = path.join(contractsDir, "exports");
  const abisDir = path.join(exportsDir, "abis");

  // Contracts to export
  const contracts = [
    { name: "CapTable", artifactPath: "CapTable.sol/CapTable.json" },
    { name: "ChainEquityToken", artifactPath: "ChainEquityToken.sol/ChainEquityToken.json" },
  ];

  // Ensure exports/abis directory exists
  if (!fs.existsSync(abisDir)) {
    fs.mkdirSync(abisDir, { recursive: true });
    console.log(`Created directory: ${abisDir}`);
  }

  console.log(`Exporting ABIs from ${artifactsDir} to ${abisDir}\n`);

  // Process each contract
  for (const contract of contracts) {
    const artifactPath = path.join(artifactsDir, contract.artifactPath);
    const outputPath = path.join(abisDir, `${contract.name}.json`);

    try {
      // Check if artifact file exists
      if (!fs.existsSync(artifactPath)) {
        throw new Error(
          `Artifact file not found: ${artifactPath}\n` +
          `Please compile contracts first using: npx hardhat compile`
        );
      }

      // Read and parse artifact file
      const artifactContent = fs.readFileSync(artifactPath, "utf-8");
      let artifact;
      try {
        artifact = JSON.parse(artifactContent);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        throw new Error(
          `Failed to parse artifact file ${artifactPath}: ${errorMessage}\n` +
          `The artifact file may be corrupted or malformed.`
        );
      }

      // Extract ABI
      if (!artifact.abi) {
        throw new Error(
          `Artifact file ${artifactPath} does not contain an 'abi' field.\n` +
          `This may indicate an incomplete or invalid artifact.`
        );
      }

      if (!Array.isArray(artifact.abi)) {
        throw new Error(
          `Artifact 'abi' field is not an array in ${artifactPath}.\n` +
          `Expected array, got: ${typeof artifact.abi}`
        );
      }

      // Write ABI array to output file
      fs.writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2));

      console.log(`✅ Exported ${contract.name} ABI (${artifact.abi.length} entries) -> ${outputPath}`);
    } catch (error) {
      console.error(`❌ Failed to export ${contract.name}:`);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(errorMessage);
      process.exit(1);
    }
  }

  console.log(`\n✨ Successfully exported ${contracts.length} contract ABIs`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
