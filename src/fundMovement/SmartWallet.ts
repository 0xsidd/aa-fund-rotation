import {
  createThirdwebClient,
  getContract,
  sendBatchTransaction,
} from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { smartWallet, privateKeyToAccount } from "thirdweb/wallets";
import { sendTransaction, prepareContractCall } from "thirdweb/transaction";
import { approve, decimals, balanceOf } from "thirdweb/extensions/erc20";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import {
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  SILO_COLLATERAL,
} from "../constants/contract.js";

dotenv.config();

// Sonic Chain Configuration
const sonicChain = defineChain({
  id: 146,
  name: "Sonic",
  nativeCurrency: {
    name: "Sonic",
    symbol: "S",
    decimals: 18,
  },
  rpc: process.env.SONIC_RPC || "https://rpc.ankr.com/sonic_mainnet",
  blockExplorers: [
    {
      name: "Sonic Explorer",
      url: "https://sonicscan.org/",
    },
  ],
});

// USDC Contract Address on Sonic
const USDC_CONTRACT_ADDRESS = CONTRACT_ADDRESSES.USDC_TOKEN;

/**
 * Smart wallet implementation for interacting with DeFi protocols on Sonic Chain
 * @dev This class provides a wrapper around thirdweb's smart wallet implementation with specific
 * functionality for Sonic Chain DeFi protocols (Aave and Silo).
 * The wallet supports:
 * - USDC deposits and withdrawals with Aave
 * - USDC deposits and withdrawals with Silo (using bUSDC)
 * - Batch transactions and multicalls for gas optimization
 * @notice Requires environment variables:
 * - THIRDWEB_CLIENT_ID
 * - THIRDWEB_SECRET_KEY
 * - SIGNER_PRIVATE_KEY
 */
export class SonicSmartWallet {
  private client: any;
  private smartWalletInstance: any;
  private signerAccount: any;
  private usdcContract: any;
  private aaveContract: any;
  private siloContract: any;
  private siloBusdContract: any;

  /**
   * Initializes the smart wallet and its contract interfaces
   * @dev Constructor performs the following:
   * 1. Creates thirdweb client with provided credentials
   * 2. Initializes signer account from private key
   * 3. Sets up contract interfaces for:
   *    - USDC (ERC20)
   *    - Aave lending pool
   *    - Silo protocol
   *    - bUSDC (Silo's wrapped USDC)
   * @throws Error if:
   * - Required environment variables are missing
   * - Contract initialization fails
   * - Invalid addresses are provided
   */
  constructor() {
    // Initialize thirdweb client
    this.client = createThirdwebClient({
      clientId: process.env.THIRDWEB_CLIENT_ID!,
      secretKey: process.env.THIRDWEB_SECRET_KEY,
    });

    // Create signer account from private key
    this.signerAccount = privateKeyToAccount({
      client: this.client,
      privateKey: process.env.SIGNER_PRIVATE_KEY!,
    });

    this.initializeContracts();
  }

  private initializeContracts() {
    try {
      // Initialize USDC contract
      if (USDC_CONTRACT_ADDRESS && ethers.isAddress(USDC_CONTRACT_ADDRESS)) {
        this.usdcContract = getContract({
          client: this.client,
          chain: sonicChain,
          address: USDC_CONTRACT_ADDRESS,
          abi: CONTRACT_ABIS.ERC_20_ABI as any,
        });
        console.log(`USDC Contract initialized: ${USDC_CONTRACT_ADDRESS}`);
      }

      // Initialize BUSD Token contract
      const busdcAddress = CONTRACT_ADDRESSES.B_USDC_TOKEN;
      if (busdcAddress && ethers.isAddress(busdcAddress)) {
        this.siloBusdContract = getContract({
          client: this.client,
          chain: sonicChain,
          address: busdcAddress,
          abi: CONTRACT_ABIS.ERC_20_ABI as any,
        });
        console.log(`BUSD initialized: ${busdcAddress}`);
      } else {
        console.log("BUSD address not configured");
      }

      // Initialize AAVE contract
      const aaveCA = CONTRACT_ADDRESSES.AAVE;
      if (aaveCA && ethers.isAddress(aaveCA)) {
        this.aaveContract = getContract({
          client: this.client,
          chain: sonicChain,
          address: aaveCA,
          abi: CONTRACT_ABIS.AAVE_ABI as any,
        });
        console.log(`Aave initialized: ${aaveCA}`);
      } else {
        console.log("Aave address not configured");
      }

      // Initialize SILO Router contract
      const siloRouterAddress = CONTRACT_ADDRESSES.SILO;
      if (siloRouterAddress && ethers.isAddress(siloRouterAddress)) {
        this.siloContract = getContract({
          client: this.client,
          chain: sonicChain,
          address: siloRouterAddress,
          abi: CONTRACT_ABIS.SILO_ABI as any,
        });
        console.log(`silo router initialized: ${siloRouterAddress}`);
      } else {
        console.log("silo router address not configured");
      }
    } catch (error) {
      console.log("Error initializing contracts:", error);
    }
  }

  async initializeSmartWallet(): Promise<void> {
    try {
      this.smartWalletInstance = smartWallet({
        chain: sonicChain,
        sponsorGas: false,
        gasless: false,
      });

      await this.smartWalletInstance.connect({
        client: this.client,
        personalAccount: this.signerAccount,
      });

      const address = this.smartWalletInstance.getAccount()?.address;
      console.log("Smart Wallet Address:", address);
    } catch (error) {
      console.error("Error initializing smart wallet:", error);
      throw error;
    }
  }

  async getWalletAddress(): Promise<string> {
    if (!this.smartWalletInstance) {
      throw new Error(
        "Smart wallet not initialized. Call initializeSmartWallet() first."
      );
    }
    return this.smartWalletInstance.getAccount()?.address;
  }

  /**
   * Converts a human-readable token amount to its corresponding token units based on the token's decimals
   * @dev This function attempts to get the token's decimals from the contract. If that fails, it defaults to 6 decimals (USDC standard)
   * @param amount The amount to convert as a string (e.g., "1.0" for 1 token)
   * @param tokenAddress The contract address of the token
   * @returns A Promise that resolves to the amount in token units as a string
   * @throws Error if the token contract is invalid or if the conversion fails
   * @example
   * // For a token with 6 decimals (like USDC)
   * // "1.0" => "1000000"
   * // For a token with 18 decimals (like ETH)
   * // "1.0" => "1000000000000000000"
   */
  private async getTokenAmount(
    amount: string,
    tokenAddress: string
  ): Promise<string> {
    try {
      // Create a contract instance for the token
      const tokenContract = getContract({
        client: this.client,
        chain: sonicChain,
        address: tokenAddress,
      });

      // Get the token's decimals using thirdweb's built-in function
      const tokenDecimals = await decimals({
        contract: tokenContract,
      });

      // Convert amount using the actual token decimals
      return ethers.parseUnits(amount, tokenDecimals).toString();
    } catch (error) {
      console.error("Error converting token amount:", error);
      // Fallback to common decimals if reading fails
      console.log("Falling back to 6 decimals for USDC");
      return ethers.parseUnits(amount, 6).toString();
    }
  }

  /**
   * Checks if the user has sufficient USDC balance for a transaction
   * @param amount The amount to check against the balance
   * @returns Promise<boolean> True if user has sufficient balance, false otherwise
   * @throws Error if USDC contract is not initialized or balance check fails
   */
  private async hasEnoughUSDC(amount: string): Promise<boolean> {
    try {
      if (!this.smartWalletInstance || !this.usdcContract) {
        throw new Error("Smart wallet or USDC contract not initialized");
      }

      const account = this.smartWalletInstance.getAccount();
      if (!account) {
        throw new Error("Failed to get account from smart wallet");
      }

      // Convert input amount to USDC units
      const requiredAmount = await this.getTokenAmount(
        amount,
        CONTRACT_ADDRESSES.USDC_TOKEN
      );

      // Get current USDC balance
      const balance = await balanceOf({
        contract: this.usdcContract,
        address: account.address,
      });

      const hasEnough = BigInt(balance.toString()) >= BigInt(requiredAmount);
      if (!hasEnough) {
        console.log(
          `Insufficient USDC balance. Required: ${amount} USDC, Available: ${ethers.formatUnits(
            balance.toString(),
            6
          )} USDC`
        );
      }
      return hasEnough;
    } catch (error) {
      console.error("Error checking USDC balance:", error);
      throw error;
    }
  }

  /**
   * Approves and supplies USDC tokens to the Aave lending pool
   * @dev This function performs two operations in a single transaction using batch transaction:
   * 1. Approves Aave contract to spend USDC
   * 2. Supplies USDC to Aave lending pool
   * @param amount The amount of USDC to supply as a string (e.g., "1.0" for 1 USDC)
   * @returns A Promise that resolves to the transaction hash of the batch transaction
   * @throws Error if:
   * - Smart wallet is not initialized
   * - USDC contract is not initialized
   * - Aave contract is not initialized
   * - Failed to get account from smart wallet
   * - Any transaction (approve/supply) fails
   * @example
   * // Supply 100 USDC to Aave
   * const txHash = await approveAndSupplyToAave("100.0");
   */
  async approveAndSupplyToAave(amount: string): Promise<string> {
    try {
      // Check USDC balance before proceeding
      const hasBalance = await this.hasEnoughUSDC(amount);
      if (!hasBalance) {
        throw new Error("Insufficient USDC balance for Aave supply");
      }

      if (!this.smartWalletInstance) {
        throw new Error("Smart wallet not initialized");
      }

      if (!this.usdcContract) {
        throw new Error("USDC contract not initialized");
      }

      if (!this.aaveContract) {
        throw new Error("Contract 1 not initialized");
      }

      const account = this.smartWalletInstance.getAccount();
      if (!account) {
        throw new Error("Failed to get account from smart wallet");
      }

      // Convert amount to USDC units (6 decimals)
      const amountDecimals = await this.getTokenAmount(
        amount,
        CONTRACT_ADDRESSES.USDC_TOKEN
      );

      const approveTransaction = prepareContractCall({
        contract: this.usdcContract,
        method: "approve" as any,
        params: [CONTRACT_ADDRESSES.AAVE, amountDecimals],
      });

      const refferalCode = "0";

      // Prepare deposit transaction
      const depositTransaction = prepareContractCall({
        contract: this.aaveContract,
        method: "supply" as any,
        params: [
          CONTRACT_ADDRESSES.USDC_TOKEN,
          amountDecimals,
          account.address,
          refferalCode,
        ],
      });

      const combinedTransaction = [approveTransaction, depositTransaction];

      // Then send deposit
      const batchTransaction = await sendBatchTransaction({
        transactions: combinedTransaction as any,
        account: account,
      });
      console.log(
        `Deposit to AAVE completed: ${batchTransaction.transactionHash}`
      );

      return batchTransaction.transactionHash;
    } catch (error) {
      console.error("Error in depositing to Aave:", error);
      throw error;
    }
  }

  /**
   * Withdraws USDC tokens from the Aave lending pool
   * @dev This function withdraws the specified amount of USDC from Aave directly to the user's wallet.
   * The user must have sufficient aUSDC (Aave interest bearing USDC) balance to withdraw.
   * @param amount The amount of USDC to withdraw as a string (e.g., "1.0" for 1 USDC)
   * @returns A Promise that resolves to the transaction hash of the withdrawal
   * @throws Error if:
   * - Smart wallet is not initialized
   * - Aave contract is not initialized
   * - Failed to get account from smart wallet
   * - Insufficient aUSDC balance
   * - Withdrawal transaction fails
   * @example
   * // Withdraw 50 USDC from Aave
   * const txHash = await withdrawFromAave("50.0");
   */
  async withdrawFromAave(amount: string): Promise<string> {
    try {
      if (!this.smartWalletInstance) {
        throw new Error("Smart wallet not initialized");
      }

      if (!this.aaveContract) {
        throw new Error("Contract 1 not initialized");
      }

      const account = this.smartWalletInstance.getAccount();
      if (!account) {
        throw new Error("Failed to get account from smart wallet");
      }

      // Convert amount to USDC units (6 decimals)
      const amountDecimals = await this.getTokenAmount(
        amount,
        CONTRACT_ADDRESSES.USDC_TOKEN
      );

      // Prepare withdraw transaction
      const withdrawTransaction = prepareContractCall({
        contract: this.aaveContract,
        method: "withdraw" as any,
        params: [
          CONTRACT_ADDRESSES.USDC_TOKEN,
          amountDecimals,
          account.address,
        ],
      });

      // Execute transaction
      const result = await sendTransaction({
        transaction: withdrawTransaction,
        account: account,
      });

      console.log(`Withdraw from Aave completed: ${result.transactionHash}`);
      return result.transactionHash;
    } catch (error) {
      console.error("Error in Function 2:", error);
      throw error;
    }
  }

  /**
   * Approves USDC and deposits it to Silo protocol using multicall functionality
   * @dev This function performs multiple operations using two transactions:
   * 1. First transaction: Approves Silo contract to spend USDC
   * 2. Second transaction (multicall): Combines three operations:
   *    - TransferFrom: Moves USDC to Silo contract
   *    - Approve: Allows conversion to bUSDC (Silo's wrapped USDC)
   *    - Deposit: Deposits USDC into Silo protocol
   * @param amount The amount of USDC to deposit as a string (e.g., "1.0" for 1 USDC)
   * @returns A Promise that resolves to the transaction hash of the batch transaction
   * @throws Error if:
   * - Smart wallet is not initialized
   * - USDC contract is not initialized
   * - Silo contract is not initialized
   * - Failed to get account from smart wallet
   * - Any transaction in the sequence fails (approval or multicall)
   * @example
   * // Deposit 100 USDC to Silo
   * const txHash = await approveAndDepositToSilo("100.0");
   */
  async approveAndDepositToSilo(amount: string): Promise<string> {
    try {
      // Check USDC balance before proceeding
      const hasBalance = await this.hasEnoughUSDC(amount);
      if (!hasBalance) {
        throw new Error("Insufficient USDC balance for Silo deposit");
      }

      if (!this.smartWalletInstance) {
        throw new Error("Smart wallet not initialized");
      }

      if (!this.usdcContract) {
        throw new Error("USDC contract not initialized");
      }

      if (!this.siloContract) {
        throw new Error("Contract 2 not initialized");
      }

      const account = this.smartWalletInstance.getAccount();
      if (!account) {
        throw new Error("Failed to get account from smart wallet");
      }

      // Convert amount to USDC units
      const amountDecimals = await this.getTokenAmount(
        amount,
        CONTRACT_ADDRESSES.USDC_TOKEN
      );

      // Step 1: Execute normal USDC approval transaction
      const approveTransaction = approve({
        contract: this.usdcContract,
        spender: CONTRACT_ADDRESSES.SILO,
        amount: amountDecimals,
      });

      // Step 2: Generate transferFrom,approve and deposit calldata for multicall
      const finalCalldata: string[] = [];

      // generate transferFrom calldata
      const transferFromCalldata = this.generateTransferFromCalldata(
        CONTRACT_ADDRESSES.USDC_TOKEN,
        CONTRACT_ADDRESSES.SILO,
        amountDecimals
      );
      finalCalldata.push(transferFromCalldata);

      // generate approve calldata
      const approveCalldata = this.generateApproveCalldata(
        CONTRACT_ADDRESSES.USDC_TOKEN,
        CONTRACT_ADDRESSES.B_USDC_TOKEN,
        amountDecimals
      );
      finalCalldata.push(approveCalldata);

      const depositCalldata = this.generateDepositCalldata(
        CONTRACT_ADDRESSES.B_USDC_TOKEN,
        amountDecimals,
        SILO_COLLATERAL
      );

      finalCalldata.push(depositCalldata);

      // Prepare multicall transaction with deposit calldata
      const multicallTransaction = prepareContractCall({
        contract: this.siloContract,
        method: "multicall" as any,
        params: [finalCalldata], // Array of calldata
      });

      const combinedTransaction = [approveTransaction, multicallTransaction];
      const batchTransaction = await sendBatchTransaction({
        transactions: combinedTransaction as any,
        account: account,
      });

      console.log(`Deposit completed: ${batchTransaction.transactionHash}`);
      return batchTransaction.transactionHash;
    } catch (error) {
      console.error("Error in Function 3:", error);
      throw error;
    }
  }

  /**
   * Withdraws deposited USDC from the Silo protocol
   * @dev This function redeems bUSDC (Silo's wrapped USDC) back to USDC.
   * The function automatically uses the entire bUSDC balance for redemption.
   * The redemption process:
   * 1. Checks bUSDC balance of the user
   * 2. Redeems bUSDC for the underlying USDC
   * 3. Transfers USDC back to the user's wallet
   * @returns A Promise that resolves to the transaction hash of the withdrawal
   * @throws Error if:
   * - Smart wallet is not initialized
   * - Silo contract is not initialized
   * - Failed to get account from smart wallet
   * - No bUSDC balance to withdraw
   * - Redemption transaction fails
   * @example
   * // Withdraw entire bUSDC balance from Silo
   * const txHash = await withdrawFromSilo();
   */
  async withdrawFromSilo(): Promise<string> {
    try {
      if (!this.smartWalletInstance) {
        throw new Error("Smart wallet not initialized");
      }

      if (!this.siloContract) {
        throw new Error("Contract 2 not initialized");
      }

      const account = this.smartWalletInstance.getAccount();
      if (!account) {
        throw new Error("Failed to get account from smart wallet");
      }

      // Get the balance of B_USDC tokens for the account
      const balanceResult = await balanceOf({
        contract: this.siloBusdContract,
        address: account.address,
      });
      const amountDecimals = balanceResult.toString();

      console.log("Shares balance: ", amountDecimals);

      // Prepare withdraw transaction
      const withdrawTransaction = prepareContractCall({
        contract: this.siloBusdContract,
        method: "redeem" as any,
        params: [
          amountDecimals,
          account.address,
          account.address,
          SILO_COLLATERAL,
        ],
      });

      // Execute transaction
      const result = await sendTransaction({
        transaction: withdrawTransaction,
        account: account,
      });

      console.log(`Withdraw from Silo completed: ${result.transactionHash}`);
      return result.transactionHash;
    } catch (error) {
      console.error("Error in Withdrawing from Silo:", error);
      throw error;
    }
  }

  // ==================== MULTICALL FUNCTION ====================

  /**
   * Generates the calldata for transferring tokens from one address to another
   * @dev Uses the ERC20 transferFrom function signature from the Silo ABI
   * @param from The address to transfer tokens from
   * @param to The address to transfer tokens to
   * @param amount The amount of tokens to transfer (in token base units)
   * @returns The encoded function call data as a hex string
   * @throws Error if the encoding fails or ABI interface is invalid
   */
  private generateTransferFromCalldata(
    from: string,
    to: string,
    amount: string
  ): string {
    try {
      const usdcInterface = new ethers.Interface(CONTRACT_ABIS.SILO_ABI);
      return usdcInterface.encodeFunctionData("transferFrom", [
        from,
        to,
        amount,
      ]);
    } catch (error) {
      console.error("Error generating approve calldata:", error);
      return "";
    }
  }

  /**
   * Generates the calldata for approving token spending
   * @dev Uses the ERC20 approve function signature from the Silo ABI
   * @param owner The token contract address
   * @param spender The address being granted spending permission
   * @param amount The amount of tokens to approve (in token base units)
   * @returns The encoded function call data as a hex string
   * @throws Error if the encoding fails or ABI interface is invalid
   */
  private generateApproveCalldata(
    owner: string,
    spender: string,
    amount: string
  ): string {
    try {
      const usdcInterface = new ethers.Interface(CONTRACT_ABIS.SILO_ABI);

      return usdcInterface.encodeFunctionData("approve", [
        owner,
        spender,
        amount,
      ]);
    } catch (error) {
      console.error("Error generating approve calldata:", error);
      return "";
    }
  }

  /**
   * Generates the calldata for depositing tokens into Silo protocol
   * @dev Uses the deposit function signature from the Silo ABI
   * @param borrowedAsset The address of the asset being deposited (e.g., bUSDC)
   * @param amount The amount of tokens to deposit (in token base units)
   * @param collateral The collateral type identifier for Silo
   * @returns The encoded function call data as a hex string
   * @throws Error if the encoding fails or ABI interface is invalid
   */
  private generateDepositCalldata(
    borrowedAsset: string,
    amount: string,
    collateral: string
  ): string {
    try {
      const siloInterface = new ethers.Interface(CONTRACT_ABIS.SILO_ABI as any);
      return siloInterface.encodeFunctionData("deposit", [
        borrowedAsset,
        amount,
        collateral,
      ]);
    } catch (error) {
      console.error("Error generating deposit calldata:", error);
      return "";
    }
  }
}
