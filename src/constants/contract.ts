import { AAVE_ABI } from "../abi/aave.js";
import { SILO_ABI } from "../abi/silo.js";
import { ERC_20_ABI } from "../abi/erc20.js";

// Contract Addresses on Sonic Chain
export const CONTRACT_ADDRESSES = {
  AAVE: "0x5362dBb1e601abF3a4c14c22ffEdA64042E5eAA3",
  SILO: "0x9Fa3C1E843d8eb1387827E5d77c07E8BB97B1e50",
  USDC_TOKEN: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
  B_USDC_TOKEN: "0x322e1d5384aa4ED66AeCa770B95686271de61dc3",
} as const;

export const SILO_COLLATERAL = "1";

// Contract ABIs
export const CONTRACT_ABIS = {
  AAVE_ABI,
  SILO_ABI,
  ERC_20_ABI,
} as const;

// Export types for TypeScript
export type ContractName = keyof typeof CONTRACT_ADDRESSES;
