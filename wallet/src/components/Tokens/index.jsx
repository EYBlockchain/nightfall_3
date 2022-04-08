import React from 'react';
import PropTypes from 'prop-types';
import styles from '../../styles/tokens.module.scss';
import TokenItem from '../TokenItem/index.jsx';

export default function Tokens({ tokenList, changeChain }) {
  return (
    <div className={styles.maticTokensList}>
      <div className={styles.formHeader}>
        <div className={styles.leftSection}>
          <div className={styles.headerH5}>Balances on Polygon Nightfall</div>
        </div>
      </div>
      <div className={styles.seperator} />
      <div className={styles.tokenListSection}>
        <div className={styles.tokenListHeader}>
          <div className={styles.headerName}>Name</div>
          <div className={styles.headerBalance}>Balance</div>
          <div className={styles.headerActions}>Actions</div>
        </div>
        {tokenList.map((t, index) => (
          <TokenItem
            maticChainUsdBalance={t.maticChainUsdBalance}
            maticChainBalance={t.maticChainBalance}
            name={t.name}
            symbol={t.symbol}
            tokenAddress={t.tokenAddress}
            key={index}
            changeChain={changeChain}
          />
        ))}
      </div>
    </div>
  );
}

Tokens.propTypes = {
  tokenList: PropTypes.array.isRequired,
  changeChain: PropTypes.func.isRequired,
};
