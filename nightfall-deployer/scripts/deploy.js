/* eslint-disable camelcase */
/* eslint-disable prettier/prettier */
const hre = require('hardhat');
const config = require('config');
const fsPromises = require('node:fs/promises');

const { networks } = require('../hardhat.config.js');
const { deployMockTokens } = require('./deploy-mocks.js');

const { DEPLOY_MOCK_TOKENS = true } = process.env;

const {
    RESTRICTIONS,
    MULTISIG,
    X509: x509Params,
    SANCTIONS_CONTRACT_ADDRESS,
    DEPLOY_MOCKED_SANCTIONS_CONTRACT,
    TEST_OPTIONS: {
        addresses: { sanctionedUser },
    },
    // FEE_L2_TOKEN_ID,
    CONTRACT_ARTIFACTS,
} = config;
const { addresses } = RESTRICTIONS;
const { SIGNATURE_THRESHOLD, APPROVERS } = MULTISIG;
const { chainId } = networks[process.env.ETH_NETWORK];

// function to sort addresses into ascending order (required for SimpleMultiSig)
function sortAscending(hexArray) {
    return hexArray.sort((a, b) => {
        const x = BigInt(a);
        const y = BigInt(b);
        // eslint-disable-next-line no-nested-ternary
        return x < y ? -1 : x > y ? 1 : 0; // a bit complex because sort expects a number, not a bigint
    });
}

// function to store deployment information
async function storeDeploymentInfo(
    contractInstance,
    contractName,
    artifactPath = '/app/artifacts/contracts',
) {
    const contractInterface = {
        address: await contractInstance.getAddress(),
        abi: JSON.parse(
            await fsPromises.readFile(`${artifactPath}/${contractName}.sol/${contractName}.json`, 'utf8'),
        ).abi, // read the abi from the contract artifact
    };
    fsPromises.writeFile(
        `${CONTRACT_ARTIFACTS}/${contractName}.json`,
        JSON.stringify(contractInterface, null, 2),
    );
}

const sortedOwners = sortAscending(APPROVERS);
async function main() {
    try {
        const signers = await hre.ethers.getSigners();
        const [deployer] = signers;
        console.log('Deploying contracts with the account:', deployer.address);

        // deploy libraries first
        const Utils = await hre.ethers.getContractFactory('Utils', { signer: deployer });
        const utilsInstance = await Utils.deploy();
        await utilsInstance.waitForDeployment();

        const Verifier = await hre.ethers.getContractFactory('Verifier', { signer: deployer });
        const verifierInstance = await Verifier.deploy();
        await verifierInstance.waitForDeployment();

        const Poseidon = await hre.ethers.getContractFactory('Poseidon', { signer: deployer });
        const poseidonInstance = await Poseidon.deploy();
        await poseidonInstance.waitForDeployment();

        const MerkleTree_Stateless = await hre.ethers.getContractFactory('MerkleTree_Stateless', {
            signer: deployer,
            libraries: {
                Poseidon: await poseidonInstance.getAddress(),
            },
        });
        const merkleTreeStatelessInstance = await MerkleTree_Stateless.deploy();
        await merkleTreeStatelessInstance.waitForDeployment();

        const ChallengesUtil = await hre.ethers.getContractFactory('ChallengesUtil', {
            signer: deployer,
            libraries: {
                MerkleTree_Stateless: await merkleTreeStatelessInstance.getAddress(),
            },
        });
        const challengesUtilInstance = await ChallengesUtil.deploy();
        await challengesUtilInstance.waitForDeployment();

        // link contracts

        const Challenges = await hre.ethers.getContractFactory('Challenges', {
            signer: deployer,
            libraries: {
                ChallengesUtil: await challengesUtilInstance.getAddress(),
                Utils: await utilsInstance.getAddress(),
                Verifier: await verifierInstance.getAddress(),
            },
        });

        const Shield = await hre.ethers.getContractFactory('Shield', {
            signer: deployer,
        });

        const State = await hre.ethers.getContractFactory('State', {
            signer: deployer,
            libraries: {
                Utils: await utilsInstance.getAddress(),
            },
        });

        const SimpleMultiSig = await hre.ethers.getContractFactory('SimpleMultiSig', {
            signer: deployer,
        });
        const simpleMultiSigInstance = await SimpleMultiSig.deploy(
            SIGNATURE_THRESHOLD,
            sortedOwners,
            chainId,
        );
        await simpleMultiSigInstance.waitForDeployment();

        let sanctionsContractAddress = SANCTIONS_CONTRACT_ADDRESS;
        // if we're just testing, we want to deploy a mock sanctions list. We do it here because
        // we need to know the address to give to the Shield contract
        if (DEPLOY_MOCKED_SANCTIONS_CONTRACT === 'true') {
            const SanctionsListMock = await hre.ethers.getContractFactory('SanctionsListMock', {
                signer: deployer,
            });
            const sanctionsListMockInstance = await SanctionsListMock.deploy(sanctionedUser);
            await sanctionsListMockInstance.waitForDeployment();
            sanctionsContractAddress = await sanctionsListMockInstance.getAddress();
        }

        // now deploy the proxied contracts
        const X509 = await hre.ethers.getContractFactory('X509', { signer: deployer });
        const x509Instance = await hre.upgrades.deployProxy(X509, []);
        await x509Instance.waitForDeployment();

        const Proposers = await hre.ethers.getContractFactory('Proposers', { signer: deployer });
        const proposersInstance = await hre.upgrades.deployProxy(Proposers, []);
        await proposersInstance.waitForDeployment();

        const challengesInstance = await hre.upgrades.deployProxy(Challenges, [], {
            unsafeAllowLinkedLibraries: true,
        });
        await challengesInstance.waitForDeployment();

        const shieldInstance = await hre.upgrades.deployProxy(Shield, [], {
            initializer: 'initializeState',
        });
        await shieldInstance.waitForDeployment();

        const stateInstance = await hre.upgrades.deployProxy(
            State,
            // eslint-disable-next-line no-undef
            await Promise.all([
                proposersInstance.getAddress(),
                challengesInstance.getAddress(),
                shieldInstance.getAddress(),
            ]),
            { initializer: 'initializeState', unsafeAllowLinkedLibraries: true },
        );
        await stateInstance.waitForDeployment();

        // save the deployment info (Hardhat doesn't do this automatically)
        // eslint-disable-next-line no-undef
        await Promise.all([
            storeDeploymentInfo(x509Instance, 'X509'),
            storeDeploymentInfo(proposersInstance, 'Proposers'),
            storeDeploymentInfo(challengesInstance, 'Challenges'),
            storeDeploymentInfo(shieldInstance, 'Shield'),
            storeDeploymentInfo(stateInstance, 'State'),
            storeDeploymentInfo(simpleMultiSigInstance, 'SimpleMultiSig'),
        ]);

        // initialisation

        const { bootProposer, bootChallenger } = addresses;

        await proposersInstance.setBootProposer(bootProposer);
        await challengesInstance.setBootChallenger(bootChallenger);

        // restrict transfer amounts if required
        if (RESTRICTIONS.restrict) {
            await shieldInstance.restrictTokens(true);
            for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
                // eslint-disable-next-line no-continue
                if (token.name === 'ERC20Mock') continue; // ignore test tokens, they're already handled in the test_tokens migration

                console.log(
                    `Max allowed deposit value for ${token.name}: 
                    ${(BigInt(token.amount) < BigInt(0)
                        ? token.amount
                        : (BigInt(token.amount) / BigInt(4)).toString()
                    ).toString()}`,
                ); // BigInt division returns whole number which is a floor. Not Math.floor() needed

                console.log(`Max allowed withdraw value for ${token.name}: ${token.amount}`);
                // eslint-disable-next-line no-await-in-loop
                await shieldInstance.setRestriction(
                    token.address,
                    BigInt(token.amount) < BigInt(0)
                        ? token.amount
                        : (BigInt(token.amount) / BigInt(4)).toString(),
                    token.amount,
                );
            }
        } else await shieldInstance.restrictTokens(false);
        // set the authorisation contract interfaces
        await shieldInstance.setAuthorities(sanctionsContractAddress, await x509Instance.getAddress());
        await proposersInstance.setAuthorities(
            sanctionsContractAddress,
            await x509Instance.getAddress(),
        );
        await challengesInstance.setAuthorities(
            sanctionsContractAddress,
            await x509Instance.getAddress(),
        );

        console.log('Whitelisting is enabled unless it says "disable" here:', process.env.WHITELISTING);
        if (process.env.WHITELISTING === 'disable') {
            await x509Instance.enableWhitelisting(false);
        } else {
            const { extendedKeyUsageOIDs, certificatePoliciesOIDs, RSA_TRUST_ROOTS } =
                x509Params[process.env.ETH_NETWORK];
            // set a trusted RSA root public key for X509 certificate checks
            console.log('setting trusted public key and extended key usage OIDs');
            for (const publicKey of RSA_TRUST_ROOTS) {
                const { modulus, exponent, authorityKeyIdentifier } = publicKey;
                // eslint-disable-next-line no-await-in-loop
                await x509Instance.setTrustedPublicKey({ modulus, exponent }, authorityKeyIdentifier);
            }
            for (const extendedKeyUsageOIDGroup of extendedKeyUsageOIDs) {
                // eslint-disable-next-line no-await-in-loop
                await x509Instance.addExtendedKeyUsage(extendedKeyUsageOIDGroup);
            }
            for (const certificatePoliciesOIDGroup of certificatePoliciesOIDs) {
                // eslint-disable-next-line no-await-in-loop
                await x509Instance.addCertificatePolicies(certificatePoliciesOIDGroup);
            }
        }
        // deploy mock tokens (if required)
        if (DEPLOY_MOCK_TOKENS === 'false') {
            console.log('Mock tokens not required');
            return;
        }
        await deployMockTokens(shieldInstance, stateInstance, deployer, storeDeploymentInfo);
        console.log('Mock tokens deployed');
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();
