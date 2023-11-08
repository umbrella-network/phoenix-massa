# Umbrella

Umbrella Smart Contract (aka price oracle) for Massa blockchain

# Code organisation

* assembly: Smart Contract sources (in AssemblyScript aka AS)
* src: deploy scripts (in typescript (TS))
* build: build folder where wasm files are written

# Dev

## Setup

Create a .env file with the following keys:

```
WALLET_SECRET_KEY=
JSON_RPC_URL_PUBLIC=https://buildnet.massa.net/api/v2
MASSA_NETWORK=buildnet
# StakingBankStatic
VALIDATORS_COUNT=2
```

Note that VALIDATORS_COUNT should be set the corresponding number of validators in the deployed StakingBankStaticXXX SC.

And create an empty .env.example file.

## Build

```commandline
npm install --legacy-peer-deps
```

Build:

```commandline
npm run build:Registry && npm run build:StakingBankStaticDev && npm run build:UmbrellaFeeds
```

Deploy:

```commandline
npm run deploy:Registry && npm run deploy:StakingBankStaticDev && npm run deploy:UmbrellaFeeds
```

Update prices (test):

Update .env file with the following keys:

```commandline
VALIDATOR_0_ADDRESS=__VALIDATOR_ADDR_0__
VALIDATOR_0_PUBLIC_KEY=__VALIDATOR_0_PK__
VALIDATOR_0_SECRET_KEY=__VALIDATOR_0_SK__
VALIDATOR_1_ADDRESS=__VALIDATOR_ADDR_1__
VALIDATOR_1_PUBLIC_KEY=__VALIDATOR_1_PK__
VALIDATOR_1_SECRET_KEY=__VALIDATOR_1_SK__
```

Update StakingBankStaticDev.ts with those public keys, then re deploy and run:

```commandline
npm run update:UmbrellaFeeds
```

# Dev misc

Run unit tests:

```commandline
npm test
```
