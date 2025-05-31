import { SonicSmartWallet } from "./fundMovement/SmartWallet.js";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  try {
    // frequency in seconds in which the funds movement between the protocol will happen
    const ROTATE_DURATION = 15;
    const cycles = 10;
    const AMOUNT = "1"; // Amount to rotate between protocols

    // Initialize the smart wallet
    const wallet = new SonicSmartWallet();
    await wallet.initializeSmartWallet();

    for (let i = 0; i < cycles; i++) {
      console.log(`\n Cycle ${i + 1} of ${cycles}`);

      if (i > 0) {
        await wallet.withdrawFromSilo();
      }

      // First move to Aave
      console.log("Moving funds to Aave...");
      await wallet.approveAndSupplyToAave(AMOUNT);

      // Wait for ROTATE_DURATION seconds
      console.log(`Waiting ${ROTATE_DURATION} seconds...`);
      await sleep(ROTATE_DURATION * 1000);

      // Withdraw from Aave and move to Silo
      console.log("Withdrawing from Aave...");
      await wallet.withdrawFromAave(AMOUNT);

      await sleep(2 * 1000);

      console.log("Moving funds to Silo...");
      await wallet.approveAndDepositToSilo(AMOUNT);

      // If not the last iteration, wait before next cycle
      if (i < cycles - 1) {
        console.log(`Waiting ${ROTATE_DURATION} seconds before next cycle...`);
        await sleep(ROTATE_DURATION * 1000);
      }
    }

    console.log("\n Fund rotation completed successfully!");
  } catch (err) {
    console.error("Error during fund rotation:", err);
  }
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Run the main function
main();
