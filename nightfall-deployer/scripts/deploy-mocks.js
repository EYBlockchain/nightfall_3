/* eslint-disable prettier/prettier */
// this module deploys mock tokens for testing purposes (if needed)
const hre = require('hardhat');
const config = require('config');

const {
    TEST_OPTIONS: { addresses },
    RESTRICTIONS,
} = config;
const nERC721 = 35;

async function deployMockTokens(shieldInstance, stateInstance, deployer, storeDeploymentInfo) {

    console.log('Deploying mock contracts with the account:', deployer.address);

    const ERC20Mock = await hre.ethers.getContractFactory('ERC20Mock', { signer: deployer });
    const ERC20MockInstance = await ERC20Mock.deploy(1001010000000000); // initialSupply
    await ERC20MockInstance.waitForDeployment();

    // For ping pong tests
    await ERC20MockInstance.transfer(addresses.user1, 1000000000000);
    await ERC20MockInstance.transfer(addresses.user2, 1000000000000);

    // Fund proposer, because in adversary these need balance to submit bad transactions
    await ERC20MockInstance.transfer(addresses.proposer1, 1000000000000);
    // for testing Shield balance withdraw
    await ERC20MockInstance.transfer(await shieldInstance.getAddress(), 1000000000000);

    // set restictions for test ERC20Mock contract (we handle this differently because the address is not fixed)
    // set payment address to ERC20Mock contract
    try {
        const erc20Mock = RESTRICTIONS.tokens[process.env.ETH_NETWORK].find(
            el => el.name === 'ERC20Mock',
        );
        await shieldInstance.setRestriction(
            await ERC20MockInstance.getAddress(),
            BigInt(erc20Mock.amount) < BigInt(0) ? erc20Mock.amount : (BigInt(erc20Mock.amount) / BigInt(4)).toString(),
            erc20Mock.amount,
        );
    } catch (err) {
        console.warn(
            'Test contract restrictions were not set, and yet you have deployed test contracts',
        );
    }

    if (!config.ETH_ADDRESS) {
        // modify the fee token address to be ERCMock for tests
        await shieldInstance.setFeeL2TokenAddress(await ERC20MockInstance.getAddress());
        await stateInstance.setFeeL2TokenAddress(await ERC20MockInstance.getAddress());

        // indicates we're running a wallet test that uses hardcoded addresses
        // For e2e tests
        const ERC721Mock = await hre.ethers.getContractFactory('ERC721Mock', { signer: deployer });
        const ERC1155Mock = await hre.ethers.getContractFactory('ERC1155Mock', { signer: deployer });
        const ERC721MockInstance = await ERC721Mock.deploy();
        const ERC1155MockInstance = await ERC1155Mock.deploy();
        await ERC721MockInstance.waitForDeployment();
        await ERC1155MockInstance.waitForDeployment();

        // store the contract data
        // eslint-disable-next-line no-undef
        await Promise.all([
            storeDeploymentInfo(ERC20MockInstance, 'ERC20Mock', '/app/artifacts/contracts/mocks'),
            storeDeploymentInfo(ERC721MockInstance, 'ERC721Mock', '/app/artifacts/contracts/mocks'),
            storeDeploymentInfo(ERC1155MockInstance, 'ERC1155Mock', '/app/artifacts/contracts/mocks'),
        ]);

        // For e2e tests
        for (let i = 0; i < nERC721; i++) {
            // eslint-disable-next-line no-await-in-loop
            await ERC721MockInstance.awardItem(addresses.user1, `https://erc721mock/item-id-${i}.json`);
        }

        // For testing the wallet
        await ERC20MockInstance.transfer(addresses.liquidityProvider, 1000000000000);

        await ERC1155MockInstance.safeBatchTransferFrom(
            deployer.address,
            addresses.user1,
            [0, 1, 2, 3, 4],
            [50000, 100000, 5, 25, 40000],
            '0x00',
        );

        await ERC1155MockInstance.safeBatchTransferFrom(
            deployer.address,
            addresses.user2,
            [0, 1, 2, 3, 4],
            [50000, 100000, 5, 25, 40000],
            '0x00',
        );
    }
}

module.exports = { deployMockTokens };
