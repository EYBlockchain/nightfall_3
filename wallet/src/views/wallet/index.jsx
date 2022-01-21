import React, { useEffect, useState } from 'react';
import Assets from '../../components/Assets/index.jsx';
import Tokens from '../../components/Tokens/index.jsx';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage.js';
import styles from '../../styles/wallet.module.scss';

const tokenMapping = {
  '0xf05e9fb485502e5a93990c714560b7ce654173c3': {
    name: 'Matic Token',
    tokenType: 'ERC20',
    maticChainUsdBalance: '20',
    maticChainBalance: '10',
    symbol: 'MATIC',
  },
};

const compressedPkd = '0xa4f0567cec890e2f61c696f8f4005245774b08bb6bbd47495f861394e4b68a53';

export default function Wallet() {
  const initialTokenState = [
    {
      maticChainUsdBalance: '100',
      maticChainBalance: '10',
      name: 'ChainLink Token',
      symbol: 'LINK',
    },
    {
      maticChainUsdBalance: '100',
      maticChainBalance: '10',
      name: 'USDT',
      symbol: 'USDT',
    },
    {
      maticChainUsdBalance: '100',
      maticChainBalance: '10',
      name: 'Aave Token',
      symbol: 'AAVE',
    },
    {
      maticChainUsdBalance: '100',
      maticChainBalance: '10',
      name: 'Matic Token',
      symbol: 'MATIC',
    },
  ];
  const [tokens, setTokens] = useState(initialTokenState);

  useEffect(() => {
    async function getL2Balance() {
      const l2Balance = await getWalletBalance();
      // eslint-disable-next-line consistent-return, array-callback-return
      const updatedState = Object.keys(tokenMapping).map(t => {
        const token = l2Balance[compressedPkd][t];
        const tokenInfo = tokenMapping[t];
        if (token) {
          const { maticChainBalance, ...rest } = tokenInfo;
          return {
            maticChainBalance: token.toString(),
            ...rest,
          };
        }
      });
      const newState = initialTokenState.map(i => {
        const s = updatedState.find(u => i.symbol === u.symbol);
        if (s) return s;
        return i;
      });
      setTokens(newState.sort((a, b) => Number(b.maticChainBalance) - Number(a.maticChainBalance)));
    }
    getL2Balance();
  }, []);

  return (
    <div className={styles.wallet}>
      <Assets />
      <Tokens tokenList={tokens} />
    </div>
  );
}
