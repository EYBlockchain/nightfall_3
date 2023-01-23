import React from 'react';
import { generalise } from 'general-number';
import { Row, Spinner, Image } from 'react-bootstrap';
import importTokens from '@TokenList/index';
import {
  getAllTransactions,
  findBlocksFromBlockNumberL2,
  getStoreCircuit,
} from '@Nightfall/services/database.js';
import { getAllCommitments } from '@Nightfall/services/commitment-storage';
import { isValidWithdrawal } from '@Nightfall/services/valid-withdrawal';
import WithdrawTransaction from './withdraw.tsx';
import bridgeInfoImage from '../../assets/img/bridge-info.png';
import polygonChainImage from '../../assets/img/polygon-chain.svg';
import tickBox from '../../assets/svg/tickBox.svg';
import etherscanArrow from '../../assets/svg/etherscanGo.svg';
import TxInfoModal from '../Modals/txInfoModal.tsx';
import Web3 from '../../common-files/utils/web3';
import './index.scss';
import { getContractInstance } from '../../common-files/utils/contract';
import useInterval from '../../hooks/useInterval';
import { getPricing, setPricing, shieldAddressGet } from '../../utils/lib/local-storage';
import BigFloat from '../../common-files/classes/bigFloat';
import exportIndexdDB from '../../utils/CommitmentsBackup/export';

const supportedTokens = importTokens();

const { SHIELD_CONTRACT_NAME, ZERO } = global.nightfallConstants;
const { explorerUrl } = global.config;

const txTypeOptions = ['Deposit', 'Transfer', 'Withdraw'];
const txTypeDest = ['From Ethereum to L2', 'Private Transfer', 'From L2 to Ethereum'];

const displayTime = (start, end) => {
  const diff = Number(end) - Number(start);
  if (diff < 60) return `${Math.floor(diff)} secs ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
  return `${Math.floor(diff / 3600)} hours ago`;
};

const Transactions = () => {
  const [txs, setTxs] = React.useState([]);
  const [isActive, setActive] = React.useState('all');
  const [showModal, setShowModal] = React.useState({ show: false });
  const [delay, setDelay] = React.useState(50);

  const initialPrices = {};
  supportedTokens.forEach(t => {
    initialPrices[t.id] = 0;
  }, {});

  const [currencyValues, setCurrencyValues] = React.useState({ now: 0, ...initialPrices });
  const [circuitHashes, setCircuitHashes] = React.useState([]);

  React.useEffect(async () => {
    if (!getPricing()) await setPricing(supportedTokens.map(t => t.id));
    else if (Date.now() - getPricing().time > 86400)
      await setPricing(supportedTokens.map(t => t.id));
    setCurrencyValues(getPricing());

    const depositCircuitHash = BigInt((await getStoreCircuit(`deposit-hash`)).data).toString();
    const transferCircuitHash = BigInt((await getStoreCircuit(`transfer-hash`)).data).toString();
    const withdrawCircuitHash = BigInt((await getStoreCircuit(`withdraw-hash`)).data).toString();

    setCircuitHashes([depositCircuitHash, transferCircuitHash, withdrawCircuitHash]);
  }, []);

  useInterval(async () => {
    const transactionsDB = await getAllTransactions();
    const commitmentsDB = await getAllCommitments();
    const commits = commitmentsDB.map(c => c._id);
    const nullifiers = commitmentsDB.map(c => c.nullifier);

    const transactions = Array.from(new Set(transactionsDB)).filter(
      t =>
        t.commitments.some(c => commits.includes(c)) ||
        t.nullifiers.some(n => nullifiers.includes(n)),
    );
    const shieldContractAddress = shieldAddressGet();
    const shieldContractInstance = await getContractInstance(
      SHIELD_CONTRACT_NAME,
      shieldContractAddress,
    );
    setDelay(20000);

    const blocks = await findBlocksFromBlockNumberL2(-1);
    // TODO: MODIFY
    const promisedTxs = transactions.map(async tx => {
      const safeTransactionType = BigInt(tx.circuitHash).toString();
      let value = BigInt(tx.value);
      // The value of transfers need to be derived from the components making up the transfer
      // Add sum nullifiers in transactions
      // Subtract sum of commitments we have.
      const transferCircuitHashData = await getStoreCircuit(`transfer-hash`);
      const transferHash = BigInt(transferCircuitHashData.data).toString();
      if (safeTransactionType === transferHash)
        commitmentsDB.forEach(c => {
          if (tx.nullifiers.includes(c.nullifier)) value -= BigInt(c.preimage.value);
          else if (tx.commitments.includes(c._id)) value += BigInt(c.preimage.value);
        });

      const safeValue = value.toString();
      const { ercAddress, tokenId } = commitmentsDB.find(c => {
        return tx.commitments.includes(c._id) || tx.nullifiers.includes(c.nullifier);
      })?.preimage ?? {
        ercAddress: '0x00',
        tokenId: `0x${BigInt(0).toString(16).padStart(64, '0')}`,
      };

      // eslint-disable-next-line no-param-reassign
      if (tx?.blockNumberL2) tx.isOnChain = tx.blockNumberL2; // Temp for handling transfers
      blocks.forEach(b => {
        if (tx.isOnChain >= 0) return;
        if (b.transactionHashes.includes(tx._id)) {
          // eslint-disable-next-line no-param-reassign
          tx.isOnChain = b.blockNumberL2;
        }
        // eslint-disable-next-line no-param-reassign
        else tx.isOnChain = -1;
      });

      let withdrawReady = false;

      const circuitHashData = await getStoreCircuit(`withdraw-hash`);
      const withdrawHash = BigInt(circuitHashData.data).toString();

      if (
        safeTransactionType === withdrawHash &&
        tx.isOnChain > 0 &&
        tx.withdrawState !== 'finalised'
      ) {
        withdrawReady = await isValidWithdrawal(tx._id, shieldContractAddress);
      }
      if (tx.withdrawState === 'instant') {
        const newOwner = await shieldContractInstance.methods.advancedWithdrawals(tx._id).call();
        const myAddress = await Web3.getAccount();
        if (newOwner.toLowerCase() !== ZERO && newOwner.toLowerCase() !== myAddress.toLowerCase())
          // eslint-disable-next-line no-param-reassign
          tx.withdrawState = 'fulfilled';
      }

      const { logoURI, decimals, id, symbol } = supportedTokens.find(
        t =>
          t.address.toLowerCase() === `0x${ercAddress.slice(-40).toLowerCase()}` &&
          `0x${BigInt(t.tokenId).toString(16).padStart(64, '0')}` === tokenId,
      ) ?? {
        logoURI: null,
        decimals: 0,
        id: '',
      };
      const currencyValue = id !== '' ? currencyValues[id] : 0;
      return {
        ...tx,
        transactionHash: tx._id,
        txType: safeTransactionType,
        value: safeValue,
        now: Math.floor(Date.now() / 1000),
        logoURI,
        decimals,
        currencyValue,
        symbol,
        withdrawReady,
      };
    });
    const mappedTxs = (await Promise.all(promisedTxs)).sort(
      (a, b) => b.createdTime - a.createdTime,
    );
    setTxs(mappedTxs);
  }, delay);

  function downloadFile(content) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    a.href = URL.createObjectURL(file);
    a.download = 'pnf_bkp.json';
    a.click();
  }

  const handleExportIndedexDB = async () => {
    const exportedDB = await exportIndexdDB('nightfall_commitments');
    const filteredTables = exportedDB.filter(
      arr => arr.table === 'commitments' || arr.table === 'transactions',
    );
    downloadFile(JSON.stringify(filteredTables));
  };

  return (
    <div className="pagePartition" style={{ width: '100%' }}>
      <TxInfoModal onHide={() => setShowModal(false)} {...showModal} />
      <div className="infoWrapper">
        <div className="wrapperTabList">
          <div className="tab-list">
            <div
              className={`tab-list-item ${isActive === 'all' ? 'active' : ''}`}
              onClick={() => setActive('all')}
            >
              All Transactions
            </div>
            <div
              className={`tab-list-item ${isActive === 'pending' ? 'active' : ''}`}
              onClick={() => setActive('pending')}
            >
              Pending
            </div>
            <div
              className={`tab-list-item ${isActive === 'deposit' ? 'active' : ''}`}
              onClick={() => setActive('deposit')}
            >
              Deposits
            </div>
            <div
              className={`tab-list-item ${isActive === 'transfer' ? 'active' : ''}`}
              onClick={() => setActive('transfer')}
            >
              Transfers
            </div>
            <div
              className={`tab-list-item ${isActive === 'withdraw' ? 'active' : ''}`}
              onClick={() => setActive('withdraw')}
            >
              Withdraws
            </div>
          </div>
          <div>
            <button onClick={() => handleExportIndedexDB()} className="exportTransactionsButton">
              Export transactions
            </button>
          </div>
        </div>
        <div className="separator" />
        <div className="innerWrapper">
          {txs
            .filter(f => {
              switch (isActive) {
                case 'deposit':
                  return f.txType === circuitHashes[txTypeOptions.indexOf('Deposit')];
                case 'transfer':
                  return f.txType === circuitHashes[txTypeOptions.indexOf('Transfer')];
                case 'withdraw':
                  return f.txType === circuitHashes[txTypeOptions.indexOf('Withdraw')];
                case 'pending':
                  return f.isOnChain === -1;
                default:
                  return f;
              }
            })
            .map(tx => (
              <Row
                key={tx.transactionHash}
                className="transactionRow"
                onClick={() =>
                  setShowModal({
                    show: true,
                    transactionhash: tx.transactionHash,
                    symbol: tx.symbol,
                    value: tx.decimals
                      ? new BigFloat(BigInt(tx.value), tx.decimals).toFixed(4)
                      : BigInt(tx.value).toString(),
                    _id: tx._id,
                    recipientaddress: tx.recipientAddress,
                    withdrawready: tx.withdrawReady ? 1 : 0,
                    txtype: generalise(tx.circuitHash).hex(32).toString(),
                  })
                }
              >
                <Row>
                  <div className="transactionDetails">
                    <div>
                      {tx.isOnChain >= 0 ? (
                        <Image src={tickBox} />
                      ) : (
                        <Spinner animation="border" variant="warning" />
                      )}
                    </div>
                    <div style={{ marginLeft: '14px' }}>
                      {/* Details */}
                      <div style={{ display: 'flex', fontWeight: '600', fontSize: '14px' }}>
                        {/* tx-type-time */}
                        <div style={{ textTransform: 'capitalize' }}></div>
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
                        <div style={{ textTransform: 'capitalize' }}>
                          {tx.isOnChain >= 0 ? 'Success' : 'Pending'} •{' '}
                          {txTypeDest[circuitHashes.indexOf(tx.txType)]}{' '}
                          {!tx.withdrawState ? '' : `• ${tx.withdrawState}`}
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
                      <img src={tx.logoURI} alt="" height="32" width="32" />
                    </div>
                    <div
                      style={{
                        width: 'calc(50% - 50px)',
                        marginLeft: '8px',
                        flexShrink: '0',
                      }}
                    >
                      {/* amount-details */}
                      <div style={{ fontWeight: '600', fontSize: '14px', lineHeight: '20px' }}>
                        {tx.decimals
                          ? new BigFloat(BigInt(tx.value), tx.decimals).toFixed(4)
                          : BigInt(tx.value).toString()}{' '}
                        {tx.symbol}
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
                        $
                        {new BigFloat(BigInt(tx.value), tx.decimals)
                          .mul(tx.currencyValue)
                          .toFixed(4)}
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
                      <div style={{ fontWeight: '600', fontSize: '14px', lineHeight: '20px' }}>
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
                        <img src={polygonChainImage} alt="Polygon Chain" height="16" width="16" />
                        <div style={{ marginLeft: '4px' }}>{`${tx.transactionHash.slice(
                          0,
                          5,
                        )}...${tx.transactionHash.slice(-5)}`}</div>
                      </div>
                    </div>
                    <a
                      href={`${explorerUrl}/transaction/${tx.transactionHash}`}
                      className="etherscanLink"
                      rel="noopener noreferrer"
                      target="_blank"
                      style={{ marginLeft: '20px' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <Image src={etherscanArrow} />
                    </a>
                  </div>
                </Row>
                {tx.txType === circuitHashes[txTypeOptions.indexOf('Withdraw')] &&
                tx.isOnChain > 0 &&
                !tx.withdrawState ? (
                  <WithdrawTransaction
                    withdrawready={tx.withdrawReady}
                    transactionhash={tx.transactionHash}
                  />
                ) : (
                  <></>
                )}
              </Row>
            ))}
        </div>
        <Row>
          <div className="bottomSection">
            <img src={bridgeInfoImage} alt="" height="219" width="326" />
          </div>
        </Row>
      </div>
    </div>
  );
};

export default Transactions;
