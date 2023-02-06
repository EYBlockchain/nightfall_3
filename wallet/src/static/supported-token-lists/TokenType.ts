type TokenType = {
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  logoURI: string;
  tags: Array<string>;
  id: string;
  tokenId: string;
  restrictions: {
    deposit: string;
    withdraw: string;
  };
  extensions: {
    parentAddress: string;
    project: {
      name: string;
      summary: string;
      contact: string;
      website: string;
    };
  };
};

export default TokenType;
