/**
 * Auto-Sweep v3 Script for Tron (TRX) - Multisig Owner Permission Edition
 * Modified for Tronscan-configured multisig wallets with owner permission
 * Original by Fahd Elharaka, Modified by Grok
 * 
 * DISCLAIMER:
 * This script is for educational purposes only. Not intended for illegal activities.
 * Use at your own risk. The developer is not responsible for misuse or damage.
 * 
 * SECURITY NOTE: Plain text private keys are insecure. Use environment variables or a secure vault in production.
 */

const TronWeb = require('tronweb').TronWeb;

// Initialize TronWeb with a full node
const tronWeb = new TronWeb({
  fullHost: 'https://tron-rpc.publicnode.com'
});

// Multisig wallet configuration
const multisigAddress = 'TNUFnhLnSiCow1XsgELFmfFn57PtuTDiiz'; // Replace with your multisig wallet address
const destinationAddress = 'TGoi7MQq5WNGr9YVunea9Ptu6gjQ4qNuQa';
const privateKeys = [
  'key1', // Replace with first owner private key
  'key2', // Replace with second owner private key
  // Add more private keys as needed for threshold
];
const signatureThreshold = 2; // Replace with your owner permission threshold (e.g., 2 for 2/3)
const FEE_RESERVE_TRX = 2; // Increased for multisig owner permission tx fees
const MIN_BAL = 5; // Minimum to sweep

// Derive signer addresses for logging
const signerAddresses = privateKeys.map(pk => tronWeb.address.fromPrivateKey(pk));

async function getBalance(address) {
  try {
    const balanceInSun = await tronWeb.trx.getBalance(address);
    return balanceInSun / 1_000_000; // Convert to TRX
  } catch (error) {
    console.error('Error retrieving balance:', error);
    throw error;
  }
}

async function checkEnergy(address) {
  try {
    const accountResources = await tronWeb.trx.getAccountResources(address);
    const energyUsed = accountResources.EnergyUsed || 0;
    const energyLimit = accountResources.EnergyLimit || 0;
    return energyLimit - energyUsed;
  } catch (error) {
    console.error('Error checking energy:', error);
    throw error;
  }
}

async function sendMultisigTransaction(from, to, amountInTRX) {
  try {
    const amountInSun = amountInTRX * 1_000_000;

    // Create transaction with owner permission
    const transaction = await tronWeb.transactionBuilder.sendTrx(to, amountInSun, from, 'owner');
    
    // Collect signatures from required private keys
    const signatures = [];
    for (let i = 0; i < Math.min(signatureThreshold, privateKeys.length); i++) {
      const signedTx = await tronWeb.trx.multiSign(transaction, privateKeys[i], 'owner');
      signatures.push(signedTx.signature[0]);
    }

    // Combine signatures
    transaction.signature = signatures;

    // Verify signature count
    if (transaction.signature.length < signatureThreshold) {
      throw new Error(`Insufficient signatures: got ${transaction.signature.length}, need ${signatureThreshold}`);
    }

    // Broadcast transaction
    const result = await tronWeb.trx.sendRawTransaction(transaction);

    if (result.result) {
      console.log(`Transaction broadcasted. TXID: ${result.txid}`);
      return result;
    } else {
      throw new Error('Failed to broadcast transaction.');
    }
  } catch (error) {
    console.error('Error sending multisig transaction:', error);
    throw error;
  }
}

async function autoSweep() {
  try {
    const currentBalance = await getBalance(multisigAddress);
    console.log(`Balance: ${currentBalance.toFixed(6)} TRX`);

    if (currentBalance > MIN_BAL) {
      const energyAvailable = await checkEnergy(multisigAddress);
      if (energyAvailable < 1500) { // Higher threshold for multisig
        console.warn('Warning: Low energy. Fees will be paid with TRX.');
      }

      const transferAmount = currentBalance - FEE_RESERVE_TRX;
      console.log(`Sweeping ${transferAmount.toFixed(6)} TRX to ${destinationAddress}`);
      const result = await sendMultisigTransaction(multisigAddress, destinationAddress, transferAmount);

      const txID = result.txid;
      if (txID) {
        let confirmed = false;
        let retries = 0;
        const maxRetries = 5;

        while (!confirmed && retries < maxRetries) {
          try {
            const tx = await tronWeb.trx.getTransaction(txID);
            if (tx && tx.ret && tx.ret[0] && tx.ret[0].contractRet === 'SUCCESS') {
              confirmed = true;
              console.log(`Successfully swept ${transferAmount.toFixed(6)} TRX. TXID: ${txID}`);
            } else {
              throw new Error('Transaction not yet confirmed.');
            }
          } catch (error) {
            retries++;
            console.log(`Checking confirmation (${retries}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
        }

        if (!confirmed) {
          console.error(`Failed to confirm transaction after ${maxRetries} retries. TXID: ${txID}`);
        }
      }
    } else {
      console.log(`Balance: ${currentBalance.toFixed(6)} TRX. No action (≤ ${MIN_BAL} TRX reserve).`);
    }
  } catch (error) {
    console.error('Auto-sweep error:', error);
  }
}

async function runAutoSweep() {
  await autoSweep();
  setTimeout(runAutoSweep, 1500); // Increased to 1s to avoid rate limits
}

runAutoSweep();