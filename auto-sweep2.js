/**
 * Auto-Sweep v3 Script for Tron (TRX)
 * Developed by Fahd Elharaka
 * Email: fahd@web3dev.ma / Telegram: @Thisiswhosthis
 *
 * DISCLAIMER:
 * This script is for educational purposes only. Do not use with sensitive private keys in an insecure environment.
 * The developer is not responsible for any misuse, loss, or damage caused by this script. Use at your own risk.
 */

require('dotenv').config();
const TronWeb = require('tronweb').TronWeb;

/*const tronWeb = new TronWeb({
  fullHost: process.env.TRON_NODE || 'https://tron-rpc.publicnode.com',
  privateKey: process.env.PRIVATE_KEY
});*/

const tronWeb = new TronWeb({
  fullHost: 'https://tron-rpc.publicnode.com',
  privateKey: '21117889f96c85c63bb85f8cbe15671d62db6d5811b87be32f7d4090b141a0e2'
});

const sourceAddress = tronWeb.address.fromPrivateKey(tronWeb.defaultPrivateKey);
const destinationAddress = 'TGoi7MQq5WNGr9YVunea9Ptu6gjQ4qNuQa';
const FEE_RESERVE_TRX = 1;

async function validateAddresses() {
  if (!tronWeb.isAddress(sourceAddress) || !tronWeb.isAddress(destinationAddress)) {
    throw new Error('Invalid source or destination address');
  }
}

async function getBalance(address) {
  try {
    const balanceInSun = await tronWeb.trx.getBalance(address);
    return balanceInSun / 1_000_000;
  } catch (error) {
    console.error('Error retrieving balance:', error);
    throw error;
  }
}

async function checkEnergy(address) {
  try {
    const accountResources = await tronWeb.trx.getAccountResources(address);
    const energyLimit = accountResources.EnergyLimit || 0;
    const energyUsed = accountResources.EnergyUsed || 0;
    const energyAvailable = energyLimit - energyUsed;
    return energyAvailable >= 300; // Typical energy for TRX transfer
  } catch (error) {
    console.error('Error checking energy:', error);
    return false;
  }
}

async function sendTransaction(from, to, amountInTRX) {
  try {
    const amountInSun = amountInTRX * 1_000_000;
    const transaction = await tronWeb.transactionBuilder.sendTrx(to, amountInSun, from);
    const signedTransaction = await tronWeb.trx.sign(transaction);
    const result = await tronWeb.trx.sendRawTransaction(signedTransaction);

    if (result.result) {
      console.log(`Transaction broadcasted. TXID: ${result.txid}`);
      return result;
    } else {
      throw new Error('Failed to broadcast transaction');
    }
  } catch (error) {
    console.error('Error sending transaction:', error);
    throw error;
  }
}

async function autoSweep() {
  try {
    await validateAddresses();
    const currentBalance = await getBalance(sourceAddress);
    console.log('balance:' + currentBalance)

    if (currentBalance <= FEE_RESERVE_TRX) {
      console.log(`Balance: ${currentBalance.toFixed(6)} TRX. No action taken (balance ≤ reserve of ${FEE_RESERVE_TRX} TRX).`);
      return;
    }

    const energyAvailable = await checkEnergy(sourceAddress);
    if (!energyAvailable) {
      console.log('Warning: Insufficient energy. Transaction may require additional TRX for fees.');
    }

    const transferAmount = currentBalance - FEE_RESERVE_TRX;
    console.log(`Balance: ${currentBalance.toFixed(6)} TRX. Sending ${transferAmount.toFixed(6)} TRX.`);
    const result = await sendTransaction(sourceAddress, destinationAddress, transferAmount);

    const txID = result.txid;
    let confirmed = false;
    let retries = 0;
    const maxRetries = 5;

    while (!confirmed && retries < maxRetries) {
      try {
        const tx = await tronWeb.trx.getTransaction(txID);
        if (tx && tx.ret && tx.ret.length > 0 && tx.ret[0].contractRet === 'SUCCESS') {
          confirmed = true;
          console.log(`Successfully transferred ${transferAmount.toFixed(6)} TRX. Transaction ID: ${txID}`);
        } else {
          throw new Error('Transaction not yet confirmed');
        }
      } catch (error) {
        retries++;
        console.log(`Checking confirmation (${retries}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 5000 * Math.pow(2, retries))); // Exponential backoff
      }
    }

    if (!confirmed) {
      console.error(`Failed to confirm transaction after ${maxRetries} retries. Transaction ID: ${txID}`);
    }
  } catch (error) {
    console.error('Auto-sweep error:', error);
  }
}

async function runAutoSweep() {
  await autoSweep();
  setTimeout(runAutoSweep, 60000);
}

runAutoSweep();