import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";

// Only import solidity-coverage when running coverage task
if (process.env.HARDHAT_COVERAGE) {
  require("solidity-coverage");
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "london",
    },
  },
  networks: {
    localhost: {
      url: "http://localhost:8545",
      chainId: 31337,
    },
  },
};

module.exports = config;
