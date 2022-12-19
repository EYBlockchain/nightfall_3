# Deployment Procedure
The deployment procedure is the process of compiling the Smart Contracts, deploying them to the desired Network and performing the circuits' setup.

To perform a deployment follow the instructions bellow:
1. Create a .env file from the template file `.env.deployment.template` and change the name to match your network. e.g. `.env.deployment.my_network`. This 
  file has settings that will be used for performing the deployment. One should change them accordingly with the desired values. The following variables are 
  important to be set:
  - `ETH_NETWORK`
  - `ETH_ADDRESS`
  - `ETH_PRIVATE_KEY`
  - `BLOCKCHAIN_URL`
  - `MULTISIG_SIGNATURE_THRESHOLD`
  - `MULTISIG_APPROVERS`

2. One entry should be added under `networks` in the `truffle-config.js` file, similar to the following:
  ```
      [NETWORK_NAME]: {
        provider: () => new HDWalletProvider(config.ETH_PRIVATE_KEY, config.BLOCKCHAIN_URL),
        network_id: [NETWORK_ID],
        networkCheckTimeout: 1000000000,
        timeoutBlocks: 2000,
        confirmations: 2,
        skipDryRun: true,
        websockets: true,
        gasPrice: config.WEB3_OPTIONS.gasPrice,
        gas: config.WEB3_OPTIONS.gas,
      },
  ```
  Replace the identified placeholder with proper values:
    - `NETWORK_NAME`: with your network id. This can be any valid string, without spaces, since it doesn't conflict with the existing ones; 
    - `NETWORK_ID`: An integer number representing the ID of your network;
    - The other values are not that relevant, but the network in question might require some specifics values for them, then one should 
    verify if these values need to be changed.

  The final result would be similar to the following example:
  ```
      mumbai: {
        provider: () => new HDWalletProvider(config.ETH_PRIVATE_KEY, config.BLOCKCHAIN_URL),
        network_id: 80001,
        networkCheckTimeout: 1000000000,
        timeoutBlocks: 2000,
        confirmations: 2,
        skipDryRun: true,
        websockets: true,
        gasPrice: config.WEB3_OPTIONS.gasPrice,
        gas: config.WEB3_OPTIONS.gas,
      },
  ```
3. Like in Step 2., add a new entry for the network one desires to deploy to under ENVIRONMENTS in the config/defaults.js file. Placeholders should be replaced by proper values. To be consistent, the same values used in the previous step can be used again here. The WEB3_WS_URL is the Websocket endpoint used to communicate with the blockchain. e.g.
    ```
        [NETWORK_NAME]: {
          name: [NETWORK_NAME],
          chainId: [NETWORK_ID],
          clientApiUrl: process.env.CLIENT_HOST
            ? `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`
            : 'http://localhost:8080',
          optimistApiUrl: process.env.OPTIMIST_HOST
            ? `http://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_PORT}`
            : 'http://localhost:8081',
          optimistWsUrl: process.env.OPTIMIST_HOST
            ? `ws://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_WS_PORT}`
            : 'ws://localhost:8082',
          proposerBaseUrl: process.env.PROPOSER_HOST
            ? `http://${process.env.PROPOSER_HOST}:${process.env.PROPOSER_PORT}`
            : 'http://localhost:8092',
          web3WsUrl: [WEB3_WS_URL],
          adversarialOptimistApiUrl: `https://${process.env.OPTIMIST_HTTP_HOST}`,
          adversarialOptimistWsUrl: `wss://${process.env.OPTIMIST_HOST}`,
          PROPOSER_KEY: process.env.PROPOSER_KEY,
          CHALLENGER_KEY: process.env.CHALLENGER_KEY,
        },
    ```
    Sample of the settings after the placeholders being replaced with proper values: 
    ```
        mumbai: {
          name: 'mumbai',
          chainId: 80001,
          clientApiUrl: process.env.CLIENT_HOST
            ? `http://${process.env.CLIENT_HOST}:${process.env.CLIENT_PORT}`
            : 'http://localhost:8080',
          optimistApiUrl: process.env.OPTIMIST_HOST
            ? `http://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_PORT}`
            : 'http://localhost:8081',
          optimistWsUrl: process.env.OPTIMIST_HOST
            ? `ws://${process.env.OPTIMIST_HOST}:${process.env.OPTIMIST_WS_PORT}`
            : 'ws://localhost:8082',
          proposerBaseUrl: process.env.PROPOSER_HOST
            ? `http://${process.env.PROPOSER_HOST}:${process.env.PROPOSER_PORT}`
            : 'http://localhost:8092',
          web3WsUrl: `wss://ws-matic-mumbai.chainstacklabs.com`,
          adversarialOptimistApiUrl: `https://${process.env.OPTIMIST_HTTP_HOST}`,
          adversarialOptimistWsUrl: `wss://${process.env.OPTIMIST_HOST}`,
          PROPOSER_KEY: process.env.PROPOSER_KEY,
          CHALLENGER_KEY: process.env.CHALLENGER_KEY,
        },
    ```

  - If whitelist functionality is required to perform transactions on the contracts, the `WHITELISTING` environment variable should have the value 
  set to `enable` to enable the whitelisting functionality. This setting can be found in the file created in the `Step 1.`. If needed, then one is 
  going to need to setup the Root Certificate Authorities information that the contracts will trust for intermediate/end-user certificates and the 
  Extended Key Usages & Object Identifiers for each Certificate Authority that is going to be used. An entry should be added under the `X509` similar
  to the following:
    ```
      X509: {
        [NETWORK_NAME]: {
          RSA_TRUST_ROOTS: [
            {
              modulus: '0x00...',
              exponent: 65537,
              authorityKeyIdentifier: `0x...`,
            },
          ],
          certificatePoliciesOIDs: [
            [
              '0x...',
            ],
          ],
          extendedKeyUsageOIDs: [
            [
              '0x...',
            ],
          ],
        },
      },
    ```
    The properties `certificatePoliciesOIDs` and `extendedKeyUsageOIDs` are arrays and each entry are also arrays 
    with specific values for each Certificate Authority that are expected to be used for the whistelisting. For more details see the documentation 
    on how to add certificates (/doc/x509.md & /doc/adding_certificates.md). Follows a sample of a fake entry:
    ```
      X509: {
        blockchain: {
          RSA_TRUST_ROOTS: [
            {
              modulus:
                '0x00c6cdaeb44c7b8fe697a3b8a269799176078ae3cb065010f55a1f1a839ff203b1e785d6782eb9c04e0e1cf63ec7ef21c6d3201c818647b8cea476112463caa8339f03e678212f0214c4a50de21cabc8001ef269eef4930fcd1dd2911ba40d505fcee5508bd91a79aadc70cc33c77be14908b1c32f880a8bb8e2d863838cfa6bd444c47dd30f78650caf1dd947adcf48b427536d294240d40335eaee5db31399b04b3893936cc41c04602b713603526a1e003112bf213e6f5a99830fa821783340c46597e481e1ee4c0c6b3aca32628b70886a396d737537bcfae5ba51dfd6add1728aa6bde5aeb8c27289fb8e911569a41c3e3f48b9b2671c673faac7f085a195',
              exponent: 65537,
              authorityKeyIdentifier: `0x${'ef355558d6fdee0d5d02a22d078e057b74644e5f'.padStart(64, '0')}`,
            },
          ],
          certificatePoliciesOIDs: [
            // Digicert
            [
              '0x06096086480186fd6c0315000000000000000000000000000000000000000000',
              '0x060a6086480186fd6c0315020000000000000000000000000000000000000000',
            ],
            // Entrust
            ['0x060a6086480186fa6c0a01060000000000000000000000000000000000000000'],
          ],
          extendedKeyUsageOIDs: [
            // Digicert
            ['0x06082b0601050507030300000000000000000000000000000000000000000000'],
            // Entrust
            [
              '0x06096086480186fa6b280b000000000000000000000000000000000000000000',
              '0x060a2b0601040182370a030c0000000000000000000000000000000000000000',
            ],
          ],
        },
      },
    ```


  - For the section `RESTRICTIONS`, the tokens' information should be added for the network that is going to be used in the deployment. For each token 
    that is going the be handled by the network, one entry should be added. The `address` should point to the respective address of the cryptocurrency and
    `amount` is the determined max allowed value for deposits and withdrawals. One entry for `MATIC` is required. The placeholder `NETWORK_NAME` should be 
    replaced with the network name:
      ```
        tokens: {
            [NETWORK_NAME]: [
            {
              name: 'MATIC',
              address: '0x0000000000000000000000000000000000001010',
              amount: '1000000000000000000000',
            },
            ...
          ],
          ...
        }
      ```
    Follows a sample:
      ```
        tokens: {
            mumbai: [
            {
              name: 'WETH',
              address: '0xa6fa4fb5f76172d178d61b04b0ecd319c5d1c0aa',
              amount: '1000000000000000000',
            },
            {
              name: 'MATIC',
              address: '0x0000000000000000000000000000000000001010',
              amount: '1000000000000000000000',
            },
            {
              name: 'USDC',
              address: '0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747',
              amount: '1000000000',
            },
            {
              name: 'stMATIC',
              address: '0xa337f0B897a874DE1E9F75944629a03F911cFbE8',
              amount: '1000000000',
            },
            ...
          ],
          ...
        }
      ```

4. Start the deployment with the following command, where the parameter is the .env file created in the `Step 1.`.

    ```
    ./bin/deploy-contracts [.env.deployment.file]
    ```
    e.g.
    ```
    ./bin/deploy-contracts .env.deployment.my_network
    ```

    During the deployment an instance of the `worker` application is required to be up, so that the Circuits can be generated accordingly. This instance is started up 
    automatically, but it is possible to configure the worker server if one is already available, for this set `CIRCOM_WORKER_HOST` in the .env file.

    There is a variable in the .env file called `DEPLOYMENT_SERVICES`. It allows one to set the services to start up. This variable can be passed over with the command
    as well.
    ```
    DEPLOYMENT_SERVICES=client,optimist,worker ./bin/deploy-contracts .env.deployment.my_network
    ```

**One should remember to have enough funds when performing the deployment so that it can finish properly.**

After the deployment finishes successfully, one can find the files that were generated during the deployment under the folder `docker/volumes`:
- `build/contracts`: contain the ABI files.
- `proving_files`: contain circuits' files.

These files are going to be used by the applications `nightfall-client` & `nightfall-optimist`.

## Testing
For testing purposes, some addresses under `TEST_OPTIONS.addresses` in `config/defaults.js` are funded with `MATIC`. Set the variable `DEPLOY_MOCK_TOKENS` in the .env file to `false` to prevent this behavior (This will also prevent the deployment of the `ERC20Mock` Smart Contract).
