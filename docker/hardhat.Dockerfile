FROM node:18.19.1-bullseye-slim

# This creates a 'hardhat network' blockchain node (replaces ganache)
WORKDIR /app
RUN npm install --save hardhat
RUN echo '\
module.exports = {\
    networks: {\
        hardhat: {\
            chainId: 1337,\
            accounts: [\
                {\
                    privateKey: "0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e",\
                    balance: "10000000000000000000000",\      
                },\
                {\
                    privateKey: "0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d",\
                    balance: "10000000000000000000000",\      
                },\
                {\
                    privateKey: "0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb",\
                    balance: "10000000000000000000000",\      
                },\
                {\
                    privateKey: "0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6",\
                    balance: "10000000000000000000000",\      
                },\
                {\
                    privateKey: "0xabf4ed9f30bd1e4a290310d726c7bbdf39cd75a25eebd9a3a4874e10b4a0c4ce",\
                    balance: "10000000000000000000000",\      
                },\
                {\
                    privateKey: "0xcbbf1d0686738a444cf9f66fdc96289035c384c4e8d26768f94fa81f3ab6596a",\
                    balance: "10000000000000000000000",\      
                },\
                {\
                    privateKey: "0x1da216993fb96745dcba8bc6f2ef5deb75ce602fd92f91ab702d8250033f4e1c",\
                    balance: "10000000000000000000000",\      
                },\
                {\
                    privateKey: "0x955ff4fac3c1ae8a1b7b9ff197476de1f93e9f0bf5f1c21ff16456e3c84da587",\
                    balance: "10000000000000000000000",\
                },\
            ],\
            loggingEnabled: true,\
            mining: {\
                auto: false,\
                interval: 10000,\
            },\
            timeout: 100_000_000,\
        },\
    },\
}\
' > hardhat.config.js

EXPOSE 8546
ENTRYPOINT ["npx", "hardhat", "node", "--port", "8546", "--hostname", "0.0.0.0"]
