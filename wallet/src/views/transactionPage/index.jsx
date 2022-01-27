import React, { useEffect } from 'react';
import { Col, Row } from 'react-bootstrap';
import Header from '../../components/Header/header.jsx';
import SideBar from '../../components/SideBar/index.jsx';
import styles from '../../styles/transactionPage.module.scss';
import bridgeInfoImage from '../../assets/img/bridge-info.png';
import polygonChainImage from '../../assets/img/polygon-chain.svg';
import maticImage from '../../assets/svg/matic.svg';
import {
  getAllTransactions,
  findBlocksFromBlockNumberL2,
} from '../../nightfall-browser/services/database.js';

const txTypeOptions = ['Deposit', 'Transfer', 'Transfer', 'Withdraw'];
const txTypeDest = [
  'From Ethereum to L2',
  'Private Transfer',
  'Private Transfer',
  'From L2 to Ethereum',
];

const displayTime = (start, end) => {
  const diff = (Number(end) - Number(start)) / 1000;
  if (diff < 60) return `${Math.floor(diff)} secs ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
  return `${Math.floor(diff / 3600)} mins ago`;
};

export default function TransactionPage() {
  const [txs, setTxs] = React.useState([]);

  useEffect(async () => {
    const transactionsDB = await getAllTransactions();
    const transactions = Array.from(new Set(transactionsDB));
    console.log('Transaction', transactions);

    const blocks = await findBlocksFromBlockNumberL2(-1);
    // console.log()
    const mappedTxs = transactions
      .map(tx => {
        const trucString = `${tx._id.slice(0, 5)}...${tx._id.slice(-5)}`;
        const safeTransactionType = BigInt(tx.transactionType).toString();
        const safeValue = BigInt(tx.value).toString();
        blocks.forEach(b => {
          console.log('b.transactionHashes', b.transactionHashes);
          console.log('tx_id', tx._id);
          if (tx.isOnChain >= 0) return;
          if (b.transactionHashes.includes(tx._id)) {
            // eslint-disable-next-line no-param-reassign
            tx.isOnChain = b.blockNumberL2;
          }
          // eslint-disable-next-line no-param-reassign
          else tx.isOnChain = -1;
        });
        console.log('isOnChain', tx.isOnChain);
        return {
          transactionHash: tx._id,
          truncTransactionHash: trucString,
          txType: safeTransactionType,
          value: safeValue,
          isOnChain: tx.isOnChain,
          createdTime: tx.createdTime,
          now: Date.now(),
        };
      })
      .sort((a, b) => b.createdTime - a.createdTime);

    console.log('Transactions', transactions);
    setTxs(mappedTxs);
  }, []);

  return (
    <div>
      <Header />
      <div className={styles.bridgeComponent}>
        <div className={styles.bridgeComponent__left}>
          <SideBar />
        </div>
        <div className={styles.bridgeComponent__right}>
          <div className={styles.blueBack}>
            <div style={{ padding: '32px 80px' }}>
              <div
                className={styles.headerH2}
                style={{
                  fontWeight: '700',
                  fontSize: '36px',
                  lineHeight: '44px',
                  letterSpacing: '-.01em',
                }}
              >
                Transactions
              </div>
              <div className={styles.pagePartition} style={{ width: '100%' }}>
                <div className={styles.infoWrapper}>
                  <div className={styles.innerWrapper} style={{ padding: '21px 22px 0px 24px' }}>
                    <Row>
                      <Col>
                        <div
                          style={{
                            marginRight: '32px',
                            padding: '0',
                            borderRadius: 'unset',
                            fontWeight: '800',
                            fontSize: '16px',
                            lineHeight: '24px',
                            height: '44px',
                            background: 'unset',
                            color: '#7b3fe4',
                            borderBottom: '2px solid #7b3fe4',
                            display: 'flex',
                          }}
                        >
                          All Transactions
                        </div>
                      </Col>
                      <Col></Col>
                      <Col></Col>
                      <Col></Col>
                      <Col></Col>
                    </Row>
                    {/* <Row> */}
                    {/* <div
                        style={{
                          fontWeight: '600',
                          fontSize: '16px',
                          lineHeight: '150%',
                          letterSpacing: '-.01em',
                          marginTop: '16px',
                        }}
                      >
                        Today
                      </div> */}
                    {/* </Row> */}
                  </div>
                  <div className={styles.innerWrapper}>
                    {txs.map((tx, index) => (
                      <Row
                        key={index}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          justifyContent: 'spaceBetween',
                          border: '1px solid #dddfe0',
                          boxSizing: 'borderBox',
                          borderRadius: '12px',
                          margin: '0 0 8px',
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          // className={ summarySection }
                          style={{
                            padding: '20px',
                            alignItems: 'center',
                            width: '58%',
                            display: 'flex',
                          }}
                        >
                          {/* <Lottie
                            animationData={pendingLoader}
                            style={{ height: '64px', width: '64px' }}
                          /> */}
                          <div style={{ marginLeft: '14px' }}>
                            {/* Details */}
                            <div style={{ display: 'flex', fontWeight: '600', fontSize: '14px' }}>
                              {/* tx-type-time */}
                              <div style={{ textTransform: 'capitalize' }}>
                                {txTypeOptions[tx.txType]}
                              </div>
                              {/* tx-type-time-type */}
                              <div style={{ color: '#b0b4bb', paddingLeft: '5px' }}>
                                {/* tx-type-time-time */}
                                {displayTime(tx.createdTime, tx.now)}
                              </div>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                color: '#52555d',
                                fontWeight: '400',
                                fontSize: '12px',
                                lineHeight: '16px',
                              }}
                            >
                              {/* tx-status-hash */}
                              {/* <div> 1/3 • Action Required • From Mumbai to Goerli</div> */}
                              <div>
                                {tx.isOnChain >= 0 ? 'Confirmed' : 'Pending'} •{' '}
                                {txTypeDest[tx.txType]}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            padding: '20px',
                            width: '42%',
                            alignItems: 'center',
                            display: 'flex',
                          }}
                        >
                          {/* details-section */}
                          <div style={{ display: 'block' }}>
                            {/* token-image */}
                            <img src={maticImage} alt="" height="32" width="32" />
                          </div>
                          <div
                            style={{
                              width: 'calc(50% - 50px)',
                              marginLeft: '8px',
                              flexShrink: '0',
                            }}
                          >
                            {/* amount-details */}
                            <div
                              style={{ fontWeight: '600', fontSize: '14px', lineHeight: '20px' }}
                            >
                              {tx.value} MATIC
                            </div>
                            <div
                              style={{
                                color: '#52555d',
                                marginTop: '4px',
                                wordBreak: 'break-all',
                                fontWeight: '400',
                                fontSize: '12px',
                                lineHeight: '16px',
                              }}
                            >
                              $x.xx
                            </div>
                          </div>
                          <div
                            style={{
                              marginLeft: '8px',
                              width: 'calc(50% - 50px)',
                              flexShrink: '0',
                            }}
                          >
                            {/* Transaction Details */}
                            <div
                              style={{ fontWeight: '600', fontSize: '14px', lineHeight: '20px' }}
                            >
                              {/* Transaction Hash label */}
                              Transaction Hash
                            </div>
                            <div
                              style={{
                                color: '#52555d',
                                marginTop: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                fontWeight: '400',
                                fontSize: '12px',
                                lineHeight: '16px',
                              }}
                            >
                              {/* Tooltip */}
                              <img src={polygonChainImage} height="16" width="16" />
                              <div style={{ marginLeft: '4px' }}>{tx.truncTransactionHash}</div>
                            </div>
                          </div>
                        </div>
                      </Row>
                    ))}
                  </div>
                  <Row>
                    <div className={styles.bottomSection}>
                      <img src={bridgeInfoImage} alt="" height="219" width="326" />
                    </div>
                  </Row>
                </div>
                {/* <div className={styles.bridgeWrapper}></div> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
