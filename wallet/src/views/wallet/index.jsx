import React, { useEffect, useState, useContext } from 'react';
import Modal from 'react-bootstrap/Modal';
import PropTypes from 'prop-types';
import Button from 'react-bootstrap/Button';
import { generateMnemonic } from 'bip39';
import InputGroup from 'react-bootstrap/InputGroup';
import FormControl from 'react-bootstrap/FormControl';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import importTokens from '@TokenList/index';
import Assets from '@Components/Assets/index.jsx';
import Header from '@Components/Header/header.jsx';
import SideBar from '@Components/SideBar/index.jsx';
import Tokens from '@Components/Tokens/index.jsx';
import { getWalletBalance } from '@Nightfall/services/commitment-storage.js';
import { UserContext } from '../../hooks/User/index.jsx';

import './wallet.scss';
import * as Storage from '../../utils/lib/local-storage';
import Web3 from '../../common-files/utils/web3';
import { useAccount } from '../../hooks/Account/index.tsx';
import useInterval from '../../hooks/useInterval.js';

const supportedTokens = importTokens();

const { DEFAULT_ACCOUNT_NUM } = global.config;

/**
This is a modal to detect if a wallet has been initialized
*/

function WalletModal(props) {
  const [, , deriveAccounts] = useContext(UserContext);
  const [screenMnemonic, setScreenMnemonic] = useState();
  return (
    <Modal {...props} size="lg" aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">
          Create a new Polygon Nightfall Wallet
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h4>Polygon Nightfall</h4>
        <p>
          Polygon Nightfall accounts are protected by a 12 word mnemonic. It is important that you
          securely store these words. Losing access to these words will result in a loss of access
          to your funds. Do not reveal them to anyone.
        </p>
        <Container style={{ display: 'inline-block', margin: '0' }}>
          {[0, 1].map(r => (
            <Row key={r}>
              {[0, 1, 2, 3, 4, 5].map(c => (
                <Col key={c}>
                  <InputGroup className="mb-3">
                    <FormControl
                      value={
                        typeof screenMnemonic !== 'undefined'
                          ? screenMnemonic.split(' ')[r * 5 + c]
                          : ''
                      }
                      readOnly
                      aria-label="Recipient's username"
                      aria-describedby="basic-addon2"
                    />
                  </InputGroup>
                </Col>
              ))}
            </Row>
          ))}
        </Container>
        <Button onClick={() => setScreenMnemonic(generateMnemonic())}>Generate Mnemonic</Button>
      </Modal.Body>
      <Modal.Footer>
        <Button
          onClick={async () => {
            // await configureMnemonic(screenMnemonic);
            await deriveAccounts(screenMnemonic, DEFAULT_ACCOUNT_NUM);
            props.onHide();
          }}
          disabled={typeof screenMnemonic === 'undefined'}
        >
          Create Wallet
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default function Wallet({ changeChain }) {
  const { setAccountInstance } = useAccount();
  const initialPrices = {};
  supportedTokens.forEach(t => {
    initialPrices[t.id] = 0;
  }, {});

  const [currencyValues, setCurrencyValues] = useState({ now: 0, ...initialPrices });

  const initialTokenState = supportedTokens.map(t => {
    return {
      l2Balance: '0',
      currencyValue: currencyValues[t.id],
      ...t,
    };
  });
  const [tokens, setTokens] = useState(initialTokenState);
  const [state] = useContext(UserContext);
  const [modalShow, setModalShow] = useState(false);
  const [delay, setDelay] = React.useState(50);

  useEffect(async () => {
    const web3 = Web3.connection();
    const accounts = await web3.eth.getAccounts();
    setAccountInstance({
      address: accounts[0],
    });
  }, []);

  useEffect(async () => {
    const pkdsDerived = Storage.pkdArrayGet(await Web3.getAccount());
    if (state.compressedPkd === '' && !pkdsDerived) setModalShow(true);
    else setModalShow(false);
  }, []);

  useEffect(async () => {
    if (!Storage.getPricing()) await Storage.setPricing(supportedTokens.map(t => t.id));
    else if (Date.now() - Storage.getPricing().time > 86400)
      await Storage.setPricing(supportedTokens.map(t => t.id));
    setCurrencyValues(Storage.getPricing);
  }, []);

  useInterval(async () => {
    console.log('l2Balance', state.compressedPkd);
    const l2BalanceObj = await getWalletBalance(state.compressedPkd);
    const updatedState = await Promise.all(
      tokens.map(async t => {
        const currencyValue = currencyValues[t.id];
        if (Object.keys(l2BalanceObj).includes(state.compressedPkd)) {
          const token = l2BalanceObj[state.compressedPkd][t.address.toLowerCase()] ?? 0;
          return {
            ...t,
            l2Balance: token.toString(),
            currencyValue,
          };
        }
        return t;
      }),
    );
    setTokens(updatedState);
    setDelay(10000);
  }, delay);

  return (
    <div>
      <Header />
      <div className="wallet">
        <div className="walletComponents">
          <div className="walletComponents__left">
            <SideBar />
          </div>
          <div className="walletComponents__right">
            <Assets tokenList={tokens} />
            <Tokens tokenList={tokens} changeChain={changeChain} />
          </div>
        </div>
        <div>
          <WalletModal show={modalShow} onHide={() => setModalShow(false)} />
        </div>
      </div>
    </div>
  );
}

WalletModal.propTypes = {
  onHide: PropTypes.func.isRequired,
};

Wallet.propTypes = {
  changeChain: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
};
