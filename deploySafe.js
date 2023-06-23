const ethers = require('ethers');
const { EthersAdapter,  SafeFactory } = require('@safe-global/protocol-kit');
const { SafeAccountConfig } = require('@safe-global/protocol-kit');
const { SafeApiKit } = require('@safe-global/api-kit');
require('dotenv').config();

async function deploySafe() {
  // Set the RPC URL for the Goerli testnet
  const RPC_URL = 'https://eth-goerli.public.blastapi.io';
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

  // Initialize signers
  const owner1Signer = new ethers.Wallet(process.env.OWNER_1_PRIVATE_KEY, provider);
  const owner2Signer = new ethers.Wallet(process.env.OWNER_2_PRIVATE_KEY, provider);
  const owner3Signer = new ethers.Wallet(process.env.OWNER_3_PRIVATE_KEY, provider);
  const owner4Signer = new ethers.Wallet(process.env.OWNER_4_PRIVATE_KEY, provider);

  // Initialize EthersAdapter
  const ethAdapterOwner1 = new EthersAdapter({
    ethers,
    signerOrProvider: owner1Signer,
  });

  // Create SafeFactory instance and Initialize the ProtocolKit
  const safeFactory = await SafeFactory.create({ ethAdapter: ethAdapterOwner1 });

  // Configure Safe Account
  const safeAccountConfig = {
    owners: [
      await owner1Signer.getAddress(),
      await owner2Signer.getAddress(),
      await owner3Signer.getAddress(),
      await owner4Signer.getAddress(),
    ],
    threshold: 3,
  };

  // Deploy Safe
  const safeSdkOwner1 = await safeFactory.deploySafe({ safeAccountConfig });
  const safeAddress = await safeSdkOwner1.getAddress();

  console.log('Your Safe has been deployed:');
  console.log(`https://goerli.etherscan.io/address/${safeAddress}`);
  console.log(`https://app.safe.global/gor:${safeAddress}`);

  // Fundraising
  const safeAmount = ethers.utils.parseUnits('0.01', 'ether').toString();

  const transactionParameters = {
    to: safeAddress,
    value: safeAmount,
    gasLimit: 1000000, // Manually specify the gas limit
  };

  const tx = await owner1Signer.sendTransaction(transactionParameters);

  console.log('Fundraising.');
  console.log(`Deposit Transaction: https://goerli.etherscan.io/tx/${tx.hash}`);

  // Create a Transaction
  const destination = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'; // Lowercase address without '0x' prefix
  const amount = ethers.utils.parseUnits('0.005', 'ether').toString();

  const safeTransactionData = {
    to: destination,
    data: '0x',
    value: amount,
  };

  // Create a Safe transaction with the provided parameters
  const safeTransaction = await safeSdkOwner1.createTransaction(safeTransactionData);

  // Propose a Transaction
  const transactionHash = await safeSdkOwner1.getTransactionHash(safeTransaction);

  // Sign transaction to verify that the transaction is coming from owner 1
  const senderSignature = await safeSdkOwner1.signTransactionHash(transactionHash);

  await safeSdkOwner1.proposeTransaction({
    to: destination,
    data: '0x',
    value: amount,
    safeTxHash: transactionHash,
    nonce: 0,
    safeTxGas: 0,
    baseGas: 0,
    gasPrice: 0,
    gasToken: '0x0000000000000000000000000000000000000000',
    refundReceiver: '0x0000000000000000000000000000000000000000',
    signatures: [senderSignature.data],
  });

  // Get Pending Transactions
  const pendingTransactions = await safeSdkOwner1.getPendingTransactions();

  // Confirm the Transaction: Second Confirmation
  // Assumes that the first pending transaction is the transaction you want to confirm
  const transaction = pendingTransactions[0];
  const confirmTxHash = transaction.safeTxHash;

  const ethAdapterOwner2 = new EthersAdapter({
    ethers,
    signerOrProvider: owner2Signer,
  });

  const safeSdkOwner2 = await safeSdkOwner1.connect(ethAdapterOwner2);

  const signature = await safeSdkOwner2.signTransactionHash(confirmTxHash);
  try {
    const response = await safeSdkOwner2.confirmTransaction(confirmTxHash, signature.data);
    console.log('Transaction confirmed:', response);
  } catch (error) {
    console.error('Error confirming transaction:', error);
  }

  // Execute Transaction
  const afterBalance = await safeSdkOwner1.getBalance();

  console.log(`The final balance of the Safe: ${ethers.utils.formatUnits(afterBalance, 'ether')} ETH`);

  // Confirm that the Transaction was Executed
  const finalBalance = await safeSdkOwner1.getBalance();

  console.log(`The final balance of the Safe: ${ethers.utils.formatUnits(finalBalance, 'ether')} ETH`);
}

deploySafe().catch((error) => {
  console.error('Error deploying Safe:', error);
});
