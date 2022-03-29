import React, { useState, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import { AiOutlineDown } from 'react-icons/ai';
import { FiSearch } from 'react-icons/fi';
import tokensList from './Bridge/TokensList/tokensList';
import stylesModal from '../../styles/modal.module.scss';
import { UserContext } from '../../hooks/User';
import maticImg from '../../assets/img/polygon-chain.svg';
import transfer from '../../nightfall-browser/services/transfer';
import { retrieveAndDecrypt } from '../../utils/lib/key-storage';
import { getContractAddress } from '../../common-files/utils/contract';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage';

type SendModalProps = {
  currencyValue: number;
  l2Balance: string;
  name: string;
  symbol: string;
  address: string;
  logoURI: string;
  decimals: number;
  show: boolean;
  onHide: () => void;
};

const SendModal = (props: SendModalProps): JSX.Element => {
  const { state } = React.useContext(UserContext);
  const [valueToSend, setTransferValue] = useState(0);
  const [recipient, setRecipient] = useState('');
  const { onHide, show, ...initialSendToken } = props;
  const [sendToken, setSendToken] = useState(initialSendToken);
  const [filteredTokens, setFilteredTokens] = useState(
    tokensList.tokens.map(({ name, symbol, address, logoURI, decimals }) => {
      return {
        name,
        symbol,
        address,
        logoURI,
        decimals,
        currencyValue: 0,
        l2Balance: '0',
      };
    }),
  );
  const [l2Balance, setL2Balance] = useState(0);
  const [showTokensListModal, setShowTokensListModal] = useState(false);

  const filterTxs = (criteria: string) =>
    tokensList.tokens
      .filter(t => t.name.toLowerCase().includes(criteria))
      .map(({ name, symbol, address, logoURI, decimals }) => {
        return {
          name,
          symbol,
          address,
          logoURI,
          decimals,
          currencyValue: 0,
          l2Balance: '0',
        };
      });

  useEffect(() => {
    const getBalance = async () => {
      const l2bal: Record<string, Record<string, number>> = await getWalletBalance(
        state?.compressedPkd,
      );
      if (Object.hasOwnProperty.call(l2bal, state?.compressedPkd))
        setL2Balance(l2bal[state.compressedPkd][sendToken.address.toLowerCase()] ?? 0);
      else setL2Balance(0);
    };
    getBalance();
  }, [sendToken, state]);

  async function sendTx() {
    const { address: shieldContractAddress } = (await getContractAddress('Shield')).data;
    const { nsk, ask } = await retrieveAndDecrypt(state.compressedPkd);
    await transfer(
      {
        offchain: true,
        ercAddress: sendToken.address,
        tokenId: 0,
        recipientData: {
          recipientCompressedPkds: [recipient],
          values: [(Number(valueToSend) * 10 ** sendToken.decimals).toString()],
        },
        nsk,
        ask,
        fee: 1,
      },
      shieldContractAddress,
    );
    console.log('Transfer Complete');
    onHide();
  }

  return (
    <Modal contentClassName={stylesModal.modalFather} show={show} onHide={() => onHide()}>
      <Modal.Header closeButton>
        <Modal.Title>Send</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {showTokensListModal ? (
          <div className={stylesModal.modalBody}>
            <div className={stylesModal.sendModal}>
              <p className="input_search_title">
                Choose token from <span>Ethereum</span>
              </p>
              <div className="input_wrapper">
                <FiSearch />
                <input
                  type="text"
                  placeholder="Search here"
                  onChange={e => setFilteredTokens(filterTxs(e.target.value.toLowerCase()))}
                />
              </div>
              <ul className="tokens_list">
                {filteredTokens.map((token, index) => (
                  <li
                    className="tokens_line"
                    key={index}
                    onClick={() => {
                      setSendToken(token);
                      setShowTokensListModal(false);
                    }}
                  >
                    <div>
                      <img src={token.logoURI} alt="token image" />
                      <p>{token.name}</p>
                    </div>
                    <p>Balance</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className={stylesModal.modalBody}>
            <div className={stylesModal.sendModal}>
              <div>
                <input
                  type="text"
                  placeholder="Enter a Nightfall Address"
                  onChange={e => setRecipient(e.target.value)}
                  id="TokenItem_modalSend_compressedPkd"
                />
                <p>Enter a valid address existing on the Polygon Nightfall L2</p>
              </div>
              <div className={stylesModal.sendModalBalance}>
                <div className={stylesModal.letfItems}>
                  <input
                    type="text"
                    placeholder="0.00"
                    onChange={e => setTransferValue(Number(e.target.value))}
                    id="TokenItem_modalSend_tokenAmount"
                  />
                  <div className={stylesModal.maxButton}>MAX</div>
                </div>
                <div
                  className={stylesModal.rightItems}
                  onClick={() => setShowTokensListModal(true)}
                  id="TokenItem_modalSend_tokenName"
                >
                  <img src={sendToken.logoURI} alt="matic" />
                  <div>{sendToken.symbol}</div>
                  <AiOutlineDown />
                </div>
              </div>
              <div className={stylesModal.balanceText}>
                <p>
                  $ {((l2Balance / 10 ** sendToken.decimals) * sendToken.currencyValue).toFixed(4)}
                </p>
                <div className={stylesModal.right}>
                  <p>Available Balance:</p>
                  <p>
                    {(l2Balance / 10 ** sendToken.decimals).toFixed(4)} {sendToken.symbol}
                  </p>
                </div>
              </div>

              <div className={stylesModal.sendModalfooter}>
                <img src={maticImg} alt="matic icon" />
                <p className={stylesModal.gasFee}> 0.00 Matic Transfer Fee</p>
              </div>
            </div>
            <button
              type="button"
              className={stylesModal.continueTrasferButton}
              onClick={() => sendTx()}
            >
              Continue
            </button>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
};

export default SendModal;
