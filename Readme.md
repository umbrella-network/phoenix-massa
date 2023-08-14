# Umbrella

Umbrella SC for Massa blockchain

# Code organisation

* assembly: SC sources (in AssemblyScript aka AS)
* src: deploy scripts (in typescript (TS))
* build: build folder where wasm files are written

# Dev

```commandline
npm install --legacy-peer-deps
```

Build sc:

```commandline
npm run build
```

Deploy sc:

Create a .env file with the following keys:

```
WALLET_SECRET_KEY=
JSON_RPC_URL_PUBLIC=https://buildnet.massa.net/api/v2
# StakingBankStatic
VALIDATORS_COUNT=2
```

then run the 'deploy' script:

```commandline
npm run deploy:UmbrellaFeeds
```

# Dev misc

Run unit tests:

```commandline
npm test
```
