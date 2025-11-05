import * as fs from "fs";
import * as path from "path";

/**
 * Test script to validate exported ABIs and deployment artifacts.
 * 
 * Verifies:
 * - ABI files exist
 * - ABI files are valid JSON
 * - ABI files are arrays (not objects with metadata)
 * - ABIs contain expected functions/events
 * - Deployment addresses file exists and has correct structure
 */
async function main() {
  const contractsDir = path.join(__dirname, "..");
  const exportsDir = path.join(contractsDir, "exports");
  const abisDir = path.join(exportsDir, "abis");
  const deploymentsPath = path.join(exportsDir, "deployments.json");

  const contracts = [
    { name: "CapTable", expectedFunctions: ["linkToken", "recordCorporateAction", "name", "symbol"] },
    { name: "ChainEquityToken", expectedFunctions: ["mint", "executeSplit", "approveWallet", "balanceOf"] },
  ];

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => boolean, errorMessage?: string) {
    try {
      if (fn()) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}${errorMessage ? `: ${errorMessage}` : ""}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log("🧪 Testing Export Functionality\n");
  console.log("=".repeat(60));

  // Test 1: ABI directory exists
  console.log("\n1️⃣ Testing ABI Directory Structure");
  test("ABI directory exists", () => {
    return fs.existsSync(abisDir);
  });

  // Test 2: ABI files exist
  console.log("\n2️⃣ Testing ABI File Existence");
  contracts.forEach(({ name }) => {
    const filePath = path.join(abisDir, `${name}.json`);
    test(`${name}.json exists`, () => {
      return fs.existsSync(filePath);
    });
  });

  // Test 3: ABI files are valid JSON
  console.log("\n3️⃣ Testing ABI File Format");
  contracts.forEach(({ name }) => {
    const filePath = path.join(abisDir, `${name}.json`);
    test(`${name}.json is valid JSON`, () => {
      const content = fs.readFileSync(filePath, "utf-8");
      JSON.parse(content);
      return true;
    });
  });

  // Test 4: ABI files are arrays
  console.log("\n4️⃣ Testing ABI Array Structure");
  contracts.forEach(({ name }) => {
    const filePath = path.join(abisDir, `${name}.json`);
    test(`${name}.json is an array`, () => {
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return Array.isArray(content);
    }, "Expected array, got object (may contain metadata)");
  });

  // Test 5: ABI files are not empty
  console.log("\n5️⃣ Testing ABI Content");
  contracts.forEach(({ name }) => {
    const filePath = path.join(abisDir, `${name}.json`);
    test(`${name}.json is not empty`, () => {
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return Array.isArray(content) && content.length > 0;
    });
  });

  // Test 6: ABI contains expected functions
  console.log("\n6️⃣ Testing ABI Function Signatures");
  contracts.forEach(({ name, expectedFunctions }) => {
    const filePath = path.join(abisDir, `${name}.json`);
    const abi = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const functionNames = abi
      .filter((item: any) => item.type === "function")
      .map((f: any) => f.name);

    expectedFunctions.forEach((funcName) => {
      test(`${name} ABI contains function: ${funcName}`, () => {
        return functionNames.includes(funcName);
      });
    });
  });

  // Test 7: ABI contains expected events
  console.log("\n7️⃣ Testing ABI Event Signatures");
  test("CapTable ABI contains CorporateActionRecorded event", () => {
    const filePath = path.join(abisDir, "CapTable.json");
    const abi = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const eventNames = abi
      .filter((item: any) => item.type === "event")
      .map((e: any) => e.name);
    return eventNames.includes("CorporateActionRecorded");
  });

  test("ChainEquityToken ABI contains Transfer event", () => {
    const filePath = path.join(abisDir, "ChainEquityToken.json");
    const abi = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const eventNames = abi
      .filter((item: any) => item.type === "event")
      .map((e: any) => e.name);
    return eventNames.includes("Transfer");
  });

  test("ChainEquityToken ABI contains SplitExecuted event", () => {
    const filePath = path.join(abisDir, "ChainEquityToken.json");
    const abi = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const eventNames = abi
      .filter((item: any) => item.type === "event")
      .map((e: any) => e.name);
    return eventNames.includes("SplitExecuted");
  });

  // Test 8: Deployment addresses file exists
  console.log("\n8️⃣ Testing Deployment Addresses");
  test("deployments.json exists", () => {
    return fs.existsSync(deploymentsPath);
  });

  // Test 9: Deployment addresses structure
  if (fs.existsSync(deploymentsPath)) {
    test("deployments.json is valid JSON", () => {
      const content = fs.readFileSync(deploymentsPath, "utf-8");
      JSON.parse(content);
      return true;
    });

    test("deployments.json has networks structure", () => {
      const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
      return deployments.networks && typeof deployments.networks === "object";
    });

    // Check for at least one network entry
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
    const networkIds = Object.keys(deployments.networks || {});
    if (networkIds.length > 0) {
      const chainId = networkIds[0];
      const network = deployments.networks[chainId];
      
      test(`deployments.json has company entry for chain ${chainId}`, () => {
        const companies = Object.keys(network || {});
        return companies.length > 0;
      });

      if (network && Object.keys(network).length > 0) {
        const companyName = Object.keys(network)[0];
        const company = network[companyName];
        
        test(`Company ${companyName} has capTable address`, () => {
          return company.capTable && typeof company.capTable === "string";
        });

        test(`Company ${companyName} has token address`, () => {
          return company.token && typeof company.token === "string";
        });

        test(`Company ${companyName} addresses are valid format`, () => {
          const isValidAddress = (addr: string) => 
            typeof addr === "string" && addr.startsWith("0x") && addr.length === 42;
          return isValidAddress(company.capTable) && isValidAddress(company.token);
        });
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${passed + failed}`);

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed. Please review the output above.");
    process.exit(1);
  } else {
    console.log("\n✨ All tests passed!");
    process.exit(0);
  }
}

main()
  .then(() => {})
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
