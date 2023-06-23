# Safe-setup

Clone the repo for interacting with Safe contracts:
`git clone GitHub - safe-global/safe-contracts: Safe allows secure management of blockchain assets. `

For using specific version 
`git checkout v1.3.0-libs.0`

 

Installing SDKs and dotenv 

`yarn add ethers@5.7.2 @safe-global/protocol-kit` 
`yarn add ethers@5.7.2 @safe-global/api-kit` 
`yarn add ethers@5.7.2 @safe-global/safe-core-sdk-types` 
`yarn add Dotenv`

 

Add private key to the .env file

Create index.js using Safe docs

Deploy Gnosis Safe to the Hardhat development network
`yarn add hardhat` 

Run the hardhat network and deploy the Gnosis safe smart contracts
`npx hardhat node`

Can use the deployed contract address to the script

Open up a new terminal and execute the script using node
`node index.js`
