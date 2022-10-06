module.exports = {
  tokenConfigs: {
    tokenId: '0x00',
    tokenType: 'ERC20', // it can be 'ERC721' or 'ERC1155'
    tokenTypeERC721: 'ERC721',
    tokenTypeERC1155: 'ERC1155',
  },
  transferValue: process.env.TRANSFER_VALUE || 10,
  privateKey: '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
  gas: 10000000,
  gasCosts: 80000000000000000,
  fee: 1,
  BLOCK_STAKE: 1, // 1 wei
  MINIMUM_STAKE: 100, // 100 wei
  ROTATE_PROPOSER_BLOCKS: 20,
  txPerBlock: process.env.TRANSACTIONS_PER_BLOCK || 2,
  signingKeys: {
    walletTest:
      process.env.WALLET_TEST_KEY ||
      '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
    user1:
      process.env.USER1_KEY || '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69e',
    user2:
      process.env.USER2_KEY || '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
    proposer1:
      process.env.BOOT_PROPOSER_KEY ||
      '0x4775af73d6dc84a0ae76f8726bda4b9ecf187c377229cb39e1afa7a18236a69d',
    proposer2:
      process.env.PROPOSER2_KEY ||
      '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
    proposer3:
      process.env.PROPOSER3_KEY ||
      '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6',
    challenger:
      process.env.BOOT_CHALLENGER_KEY ||
      '0xd42905d0582c476c4b74757be6576ec323d715a0c7dcff231b6348b7ab0190eb',
    liquidityProvider:
      process.env.LIQUIDITY_PROVIDER_KEY ||
      '0xfbc1ee1c7332e2e5a76a99956f50b3ba2639aff73d56477e877ef8390c41e0c6',
  },
  addresses: {
    walletTest: process.env.WALLET_TEST_ADDRESS || '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
    user1: process.env.USER1_ADDRESS || '0x9C8B2276D490141Ae1440Da660E470E7C0349C63',
    user2: process.env.USER2_ADDRESS || '0xfCb059A4dB5B961d3e48706fAC91a55Bad0035C9',
  },
  zkpPublicKeys: {
    user1:
      process.env.USER1_COMPRESSED_ZKP_PUBLIC_KEY ||
      '0x236af0fee749dd191e317fc8199f20c5b3df728bd3247db0623c3085e7ff501a',
    user2:
      process.env.USER2_COMPRESSED_ZKP_PUBLIC_KEY ||
      '0x8b1cd14f2defec7928cc958e2dfbc86fbd3218e25a10807388a5db4b8fa4837e',
  },
  mnemonics: {
    user1:
      process.env.USER1_MNEMONIC ||
      'trip differ bamboo bundle bonus luxury strike mad merry muffin nose auction',
    user2:
      process.env.USER2_MNEMONIC ||
      'control series album tribe category saddle prosper enforce moon eternal talk fame',
    proposer:
      process.env.BOOT_PROPOSER_MNEMONIC ||
      'high return hold whale promote payment hat panel reduce oyster ramp mouse',
    challenger:
      process.env.BOOT_CHALLENGER_MNEMONIC ||
      'crush power outer gadget enter maze advance rather divert monster indoor axis',
    liquidityProvider:
      process.env.LIQUIDITY_PROVIDER_MNEMONIC ||
      'smart base soup sister army address member poem point quick save penalty',
  },
  restrictions: {
    erc20default: process.env.ERC20_RESTRICTION || 100000000000,
  },
};
