# Sonic Smart Wallet - DeFi Protocol Fund Rotation

A smart wallet implementation that demonstrates automated fund rotation between DeFi protocols (Aave and Silo) on the Sonic Chain using ERC4337 account abstraction.

## What This Project Does

This project automatically rotates USDC funds between two DeFi protocols:

1. **Aave Protocol**: A decentralized lending platform where users can deposit USDC to earn interest
2. **Silo Protocol**: Another DeFi lending protocol that provides isolated lending markets

The smart wallet performs these operations in cycles:

- Deposits USDC into Aave → Waits → Withdraws from Aave → Deposits into Silo → Waits → Repeats

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (or yarn/pnpm)
- **USDC tokens** on Sonic Chain (for testing the fund rotation)
- **Thirdweb account** (for smart wallet functionality)

## Environment Setup

### Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd cr-task

# Install all dependencies
npm install
```

### Step 2: Environment Variables

Create a `.env` file in the root directory and add these required variables:

```env
# Thirdweb Configuration (Required for smart wallet)
THIRDWEB_CLIENT_ID="your_thirdweb_client_id_here"
THIRDWEB_SECRET_KEY="your_thirdweb_secret_key_here"

# Your Private Key (Required for signing transactions)
SIGNER_PRIVATE_KEY="your_private_key_here"
```

#### How to Get These Values:

1. **Thirdweb Credentials**:

   - Go to [thirdweb.com](https://thirdweb.com)
   - Create an account and navigate to the dashboard
   - Create a new project to get your `CLIENT_ID` and `SECRET_KEY`

2. **Private Key**:
   - Use a wallet that has USDC on Sonic Chain
   - Export the private key from your wallet (MetaMask, etc.)
   - ⚠️ **NEVER share your private key or commit it to version control**

### Step 3: Configuration Parameters

Before running, you can modify the rotation parameters in `src/index.ts`:

```typescript
// Configuration Parameters (Line 9-11 in src/index.ts)
const ROTATE_DURATION = 30; // Time in seconds between operations
const cycles = 2; // Number of complete rotation cycles
const AMOUNT = "1"; // USDC amount to rotate (in USDC units)
```

#### Parameter Explanations:

- **`ROTATE_DURATION`**:

  - Time to wait between each protocol operation (in seconds)
  - Default: 30 seconds
  - Example: If set to 60, it waits 1 minute between each step

- **`cycles`**:

  - How many complete Aave → Silo rotation cycles to perform
  - Default: 2 cycles
  - Example: With 2 cycles, it will do: Aave → Silo → Aave → Silo

- **`AMOUNT`**:
  - Amount of USDC to move between protocols
  - Default: "1" (1 USDC)
  - Format: String representation (e.g., "10.5" for 10.5 USDC)
  - **Important**: Make sure your wallet has enough USDC + gas fees

## Running the Project

### Option 1: Full Clean Build and Run (Recommended)

```bash
npm start
```

This command will:

1. Delete the existing `./dist` folder
2. Rebuild the TypeScript project
3. Execute the fund rotation

### Option 2: Development Mode (Hot Reload)

```bash
npm run dev
```

This runs the TypeScript files directly without compilation using `tsx`.

### Option 3: Manual Build and Run

```bash
# Build only
npm run build

# Run the built version
node dist/index.js
```

## Code Formatting

This project uses Prettier for code formatting. Available commands:

```bash
# Format all files in the project
npm run format

# Check if files are properly formatted (without modifying them)
npm run format:check

# Format only source files (src directory)
npm run format:src
```

**Prettier Configuration**: The project uses the `.prettierrc` file for formatting rules:

- 2 spaces for indentation
- Semicolons enabled
- Double quotes for strings
- 80 character line width
- Trailing commas where valid in ES5

## What Happens When You Run It

The console will show output like this:

```
USDC Contract initialized: 0x29219dd400f2Bf60E5a23d13Be72B486D4038894
BUSD initialized: 0x322e1d5384aa4ED66AeCa770B95686271de61dc3
Aave initialized: 0x5362dBb1e601abF3a4c14c22ffEdA64042E5eAA3
silo router initialized: 0x9Fa3C1E843d8eb1387827E5d77c07E8BB97B1e50
Smart Wallet Address: 0x...

Cycle 1 of 2
Moving funds to Aave...
Deposit to AAVE completed: 0x...
Waiting 30 seconds...
Withdrawing from Aave...
Withdraw from Aave completed: 0x...
Moving funds to Silo...
Deposit completed: 0x...
Waiting 30 seconds before next cycle...

Cycle 2 of 2
...

Fund rotation completed successfully!
```

## Important Notes

- **Gas Fees**: Ensure your wallet has enough Sonic (S) tokens for gas fees
- **USDC Balance**: Your wallet must have sufficient USDC for the rotation amount
- **Network**: This project is configured for Sonic Chain (Chain ID: 146)
- **Safety**: This is for demonstration purposes. Use small amounts for testing

## Troubleshooting

1. **"Insufficient USDC balance"**: Add more USDC to your wallet
2. **"Smart wallet not initialized"**: Check your environment variables
3. **Network errors**: Verify you're connected to Sonic Chain
4. **Transaction failures**: Ensure sufficient gas fees and check contract addresses

## Project Structure

```
cr-task/
├── src/
│   ├── index.ts                    # Main entry point with rotation logic
│   ├── fundMovement/
│   │   └── SmartWallet.ts         # Smart wallet implementation
│   ├── constants/
│   │   └── contract.ts            # Contract addresses and ABIs
│   └── abi/                       # Contract ABIs
├── dist/                          # Compiled JavaScript (auto-generated)
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # This file
```
