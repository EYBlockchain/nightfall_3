import React from 'react';
import PropTypes from 'prop-types';
import styles from '../../styles/tokens.module.scss';
import TokenItem from '../TokenItem/index.jsx';

export default function Tokens(token) {
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
        {token.tokenList.map((t, index) => (
          <TokenItem {...t} key={index} />
        ))}
      </div>
    </div>
  );
}

Tokens.propTypes = {
  tokenList: PropTypes.array.isRequired,
};
