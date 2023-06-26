const { ethers } = require('ethers');
const SafeApiKit = require('@safe-global/api-kit').default;
const Safe = require('@safe-global/protocol-kit');
const { EthersAdapter, SafeFactory, SafeAccountConfig } = require('@safe-global/protocol-kit');
const { SafeTransactionDataPartial } = require('@safe-global/safe-core-sdk-types');
require('dotenv').config();
const { changeMaxErc20Deposit } = require('../safe-contracts/script/updateMaxDeposit.js');

const RPC_URL = 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

const owner1Signer = new ethers.Wallet(process.env.OWNER_1_PRIVATE_KEY, provider);
const owner2Signer = new ethers.Wallet(process.env.OWNER_2_PRIVATE_KEY, provider);
const owner3Signer = new ethers.Wallet(process.env.OWNER_3_PRIVATE_KEY, provider);

const ethAdapterOwner1 = new EthersAdapter({
  ethers,
  signerOrProvider: owner1Signer,
});

const txServiceUrl = 'https://safe-transaction-goerli.safe.global';
const safeService = new SafeApiKit({ txServiceUrl, ethAdapter: ethAdapterOwner1 });
let safeFactory;
let safeSdkOwner1;
let safeAddress;

const EXISTING_SAFE_ADDRESS = '0xaBd9784444Cedd834937BD82C55D72E8f7D5fcE7';

async function deploySafe() {
  console.log('Deploying Safe...');
  safeFactory = await SafeFactory.create({ ethAdapter: ethAdapterOwner1 });

  const safeAccountConfig = {
    owners: [
      await owner1Signer.getAddress(),
      await owner2Signer.getAddress(),
      await owner3Signer.getAddress(),
    ],
    threshold: 2,
    // ... (Optional params) 
    // https://github.com/safe-global/safe-core-sdk/tree/main/packages/protocol-kit#deploysafe
  };

  safeSdkOwner1 = await safeFactory.deploySafe({ safeAccountConfig });
  safeAddress = await safeSdkOwner1.getAddress();

  console.log('Your Safe has been deployed:');
  console.log(`https://goerli.etherscan.io/address/${safeAddress}`);
  console.log(`https://app.safe.global/gor:${safeAddress}`);
}

async function initalizeSafe(existingAddress = EXISTING_SAFE_ADDRESS) {
  safeAddress = existingAddress;
  console.log('safeAddress:', safeAddress)
  const ethAdapterOwner1 = new EthersAdapter({
    ethers,
    signerOrProvider: owner1Signer,
  });

  safeSdkOwner1 = await Safe.default.create({
    ethAdapter: ethAdapterOwner1,
    safeAddress,
  });
}

async function depositToSafe(depositSigner = owner1Signer, amount = '0.01') {
    const safeAmount = ethers.utils.parseEther(amount);
    const transactionParameters = {
      to: safeAddress,
      value: safeAmount,
    };
    const tx = await depositSigner.sendTransaction(transactionParameters);
    console.log(`Deposit Transaction: https://goerli.etherscan.io/tx/${tx.hash}`);
}

async function proposeTransaction(withdrawAmount = '0', destination = safeAddress) {
  withdrawAmount = ethers.utils.parseUnits(withdrawAmount, 'ether').toString();
  const safeTransactionData = {
    to: destination,
    data: '0x',
    value: withdrawAmount,
  };
  const safeTransaction = await safeSdkOwner1.createTransaction({ safeTransactionData });
  const safeTxHash = await safeSdkOwner1.getTransactionHash(safeTransaction);
  const senderSignature = await safeSdkOwner1.signTransactionHash(safeTxHash);
  await safeService.proposeTransaction({
    safeAddress,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: await owner1Signer.getAddress(),
    senderSignature: senderSignature.data,
  });
}

async function confirmTransaction() {
  const pendingTransactions = (await safeService.getPendingTransactions(safeAddress)).results;
  const transaction = pendingTransactions[0];
  const safeTxHash = transaction.safeTxHash;

  const ethAdapterOwner2 = new EthersAdapter({
    ethers,
    signerOrProvider: owner2Signer,
  });

  const safeSdkOwner2 = await Safe.default.create({
    ethAdapter: ethAdapterOwner2,
    safeAddress,
  });

  const signature = await safeSdkOwner2.signTransactionHash(safeTxHash);
  let response;
  try {
    response = await safeSdkOwner2.approveTransactionHash(safeTxHash,);
    console.log('Transaction confirmed:', response);

    // to execute updateMaxDeposit script if the transaction is approved by the accounts
    if (response.isExecuted) {
      // Execute the updateMaxDeposit script
      await changeMaxErc20Deposit(maxDepositAmount); 
    }
  } catch (error) {
    console.error('Error confirming transaction:', error);
  }
  return { safeTxHash, confirmationResponse: response };
}

async function executeTransaction(safeTxHash, safeSdk = safeSdkOwner1) {
  let safeBalance = await safeSdk.getBalance();
  console.log(`[Before Transaction] Safe Balance: ${ethers.utils.formatUnits(safeBalance, 'ether')} ETH`);
  console.log('safetxhash:', safeTxHash)
  const safeTransaction = await safeService.getTransaction(safeTxHash);
  const executeTxResponse = await safeSdk.executeTransaction(safeTransaction);
  const receipt = await executeTxResponse.transactionResponse.wait();
  console.log('Transaction executed:');
  console.log(`https://goerli.etherscan.io/tx/${receipt.transactionHash}`);
  safeBalance = await safeSdk.getBalance();
  console.log(`[After Transaction] Safe Balance: ${ethers.utils.formatUnits(safeBalance, 'ether')} ETH`);
}

async function main() {
  if (EXISTING_SAFE_ADDRESS) {
    await initalizeSafe();
  } else {
    await deploySafe();
    await depositToSafe();
  }

  await proposeTransaction();
  const { safeTxHash } = await confirmTransaction();
  await executeTransaction(safeTxHash);
}

main();
