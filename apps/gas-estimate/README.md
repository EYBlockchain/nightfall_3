# Gas Estimate Function
Gas Estimate function provides a simple endpoint to estimate Ethereum mainnet Gas price. It is expected to be used as a 
nodejs lambda function. It requires to include an environment variable, `process.env.ETH_GAS_STATION`, which is an Etherscan API Key.

Once this function is deployed, simply configure `GAS_ESTIMATE_ENDPOINT` with the endpoint URL. If this variable is not defined, the estimation is done differently by estimating the price by the last few blocks median gas price.