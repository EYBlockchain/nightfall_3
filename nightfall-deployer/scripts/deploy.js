const hre = require("hardhat");
const config = require('config');

const {
  RESTRICTIONS,
  MULTISIG,
  X509: x509Params,
  SANCTIONS_CONTRACT_ADDRESS,
  DEPLOY_MOCKED_SANCTIONS_CONTRACT,
  TEST_OPTIONS: {
    addresses: { sanctionedUser },
  },
  FEE_L2_TOKEN_ID
} = config;
const { addresses } = RESTRICTIONS;
const { SIGNATURE_THRESHOLD, APPROVERS } = MULTISIG;
const { network_id } = networks[process.env.ETH_NETWORK];

// function to sort addresses into ascending order (required for SimpleMultiSig)
function sortAscending(hexArray) {
  return hexArray.sort((a, b) => {
    x = BigInt(a);
    y = BigInt(b);
    return x < y ? -1 : x > y ? 1 : 0; // a bit complex because sort expects a number, not a bigint
  });
}

const sortedOwners = sortAscending(APPROVERS);
async function main() {
    try {
        const signers = await ethers.getSigners();
        const [deployer,] = signers;

        // deploy libraries first

        const Utils = await hre.ethers.getContractFactory("Utils", {signer: deployer});
        const utilsInstance = await Utils.deploy();
        await utilsInstance.deployed();

        const Verifier = await hre.ethers.getContractFactory("Verifier", {signer: deployer});
        const verifierInstance = await Verifier.deploy();
        await verifierInstance.deployed();

        const Poseidon = await hre.ethers.getContractFactory("Poseidon", {signer: deployer});
        const poseidonInstance = await Poseidon.deploy();
        await poseidonInstance.deployed();

        const MerkleTreeStateless = await hre.ethers.getContractFactory("MerkleTree_Stateless", {
            signer: deployer,
            libraries: {
                Poseidon: poseidonInstance.address
            }
        });
        const merkleTreeStatelessInstance = await MerkleTree_Stateless.deploy();
        await merkleTreeStatelessInstance.deployed();

        const ChallengesUtil = await hre.ethers.getContractFactory("ChallengesUtil", {
            signer: deployer,
            libraries: {
                Utils: utilsInstance.address,
                MerkleTree_Stateless: merkleTreeStatelessInstance.address,
                Verifier: verifierInstance.address,
            }
        });
        const challengesUtilInstance = await ChallengesUtil.deploy();
        await challengesUtilInstance.deployed();

        // link contracts

        const Challenges = await hre.ethers.getContractFactory("Challenges", {
            signer: deployer,
            libraries: {
                ChallengesUtil: challengesUtilInstance.address,
                Utils: utilsInstance.address,
                MerkleTree_Stateless: merkleTreeStatelessInstance.address,
                Verifier: verifierInstance.address,
            }
        });

        const Shield = await hre.ethers.getContractFactory("Shield", {
            signer: deployer,
            libraries: {
                Utils: utilsInstance.address,
            }
        });

        const State = await hre.ethers.getContractFactory("State", {
            signer: deployer,
            libraries: {
                Utils: utilsInstance.address,
            }
        });

        const SimpleMultiSig = await hre.ethers.getContractFactory("SimpleMultiSig", {signer: deployer});
        const simpleMultiSigInstance = await SimpleMultiSig.deploy(SIGNATURE_THRESHOLD, sortedOwners, network_id);
        await simpleMultiSigInstance.deployed();

        let sanctionsContractAddress = SANCTIONS_CONTRACT_ADDRESS;
        // if we're just testing, we want to deploy a mock sanctions list. We do it here because
        // we need to know the address to give to the Shield contract
        if (DEPLOY_MOCKED_SANCTIONS_CONTRACT === 'true') {
            const SanctionsListMock = await hre.ethers.getContractFactory("SanctionsListMock", {signer: deployer});
            await deployer.deploy(SanctionsListMock, sanctionedUser);
            await SanctionsListMock.deployed();
            sanctionsContractAddress = SanctionsListMock.address;
        }

        // now deploy the proxied contracts
        const X509 = await hre.ethers.getContractFactory("X509", {signer: deployer});
        x509Instance = await hre.upgrades.deployProxy(X509, []);
        await x509Instance.waitForDeployment();

        const Proposers = await hre.ethers.getContractFactory("Proposers", {signer: deployer});
        proposersInstance = await hre.upgrades.deployProxy(Proposers, []);
        await proposersInstance.waitForDeployment();

        challengesInstance = await hre.upgrades.deployProxy(Challenges, []);
        await challengesInstance.waitForDeployment();

        shieldInstance = await hre.upgrades.deployProxy(Shield, [], {initializer: 'initializeState'});
        await shieldInstance.waitForDeployment();

        stateInstance = await hre.upgrades.deployProxy(State, [proposersInstance.address, challengesInstance.address, shieldInstance.address], {initializer: 'initializeState'});
        await stateInstance.waitForDeployment();

        // initialisation

        const { bootProposer, bootChallenger } = addresses;

        await proposersInstance.setBootProposer(bootProposer);
        await challengesInstance.setBootChallenger(bootChallenger);

        // restrict transfer amounts if required
        if (RESTRICTIONS.restrict ) {
            await shieldInstance.restrictTokens(true);
            for (const token of RESTRICTIONS.tokens[process.env.ETH_NETWORK]) {
    
                if (token.name === 'ERC20Mock') 
                  continue; // ignore test tokens, they're already handled in the test_tokens migration
          
                console.log(
                  `Max allowed deposit value for ${token.name}: ${(
                    BigInt(token.amount) < BigInt(0) ? token.amount : (BigInt(token.amount) / BigInt(4)).toString()
                  ).toString()}`,
                ); // BigInt division returns whole number which is a floor. Not Math.floor() needed
          
                console.log(`Max allowed withdraw value for ${token.name}: ${token.amount}`);
                await shield.setRestriction(
                  token.address,
                  BigInt(token.amount) < BigInt(0) ? token.amount : (BigInt(token.amount) / BigInt(4)).toString(),
                  token.amount,
                );
            }
        } else await shield.restrictTokens(false);
        
        // set the authorisation contract interfaces
        await shield.setAuthorities(sanctionsContractAddress, X509.address)
        await proposers.setAuthorities(sanctionsContractAddress, X509.address)
        await challengers.setAuthorities(sanctionsContractAddress, X509.address)

        console.log('Whitelisting is enabled unless it says "disable" here:', process.env.WHITELISTING);
        if (process.env.WHITELISTING === 'disable') {
            await x509.enableWhitelisting(false);
            return;
        }

        const { extendedKeyUsageOIDs, certificatePoliciesOIDs, RSA_TRUST_ROOTS } = x509Params[process.env.ETH_NETWORK];

        // set a trusted RSA root public key for X509 certificate checks
        console.log('setting trusted public key and extended key usage OIDs');
        for (publicKey of RSA_TRUST_ROOTS) {
            const { modulus, exponent, authorityKeyIdentifier } = publicKey;
            await x509.setTrustedPublicKey({ modulus, exponent }, authorityKeyIdentifier);
        }
        for (extendedKeyUsageOIDGroup of extendedKeyUsageOIDs) {
            await x509.addExtendedKeyUsage(extendedKeyUsageOIDGroup);
        }
        for (certificatePoliciesOIDGroup of certificatePoliciesOIDs) {
            await x509.addCertificatePolicies(certificatePoliciesOIDGroup);
        }
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

main();
