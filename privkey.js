




const TronWeb = require('tronweb').TronWeb; // Explicitly import TronWeb constructor
const bip39 = require('bip39');
const HDKey = require('hdkey');

// Your OKX Wallet seed phrase (12 words)
// Your OKX Wallet seed phrase (12 words)
// Your OKX Wallet seed phrase (12 words)
const seedPhrase = 'clap zone acid tube also among tape museum boy film soda salt';

const derivationPath = "m/44'/195'/0'/0/0"; // Tron derivation path

// Convert seed phrase to seed
const seed = bip39.mnemonicToSeedSync(seedPhrase);

// Derive private key using hdkey
const hdKey = HDKey.fromMasterSeed(seed);
const derivedKey = hdKey.derive(derivationPath);
const privateKey = derivedKey.privateKey.toString('hex');

// Initialize TronWeb with the private key
const tronWeb = new TronWeb({
  fullHost: 'https://api.trongrid.io', // Tron full node
  privateKey: privateKey,
});

// Get Tron address
const address = tronWeb.address.fromPrivateKey(privateKey);
console.log('Tron Private Key:', privateKey);
console.log('Tron Address:', address);