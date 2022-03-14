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
import Assets from '../../components/Assets/index.jsx';
import Header from '../../components/Header/header.jsx';
import SideBar from '../../components/SideBar/index.jsx';
import Tokens from '../../components/Tokens/index.jsx';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage.js';
import { UserContext } from '../../hooks/User/index.jsx';

import './wallet.scss';
import * as Storage from '../../utils/lib/local-storage';
import Web3 from '../../common-files/utils/web3';
import { getContractAddress } from '../../common-files/utils/contract.js';

const { DEFAULT_ACCOUNT_NUM } = global.config;

/*
These are some default values for now
*/

const initialTokenState = [
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'ChainLink Token',
    symbol: 'LINK',
    order: 2,
    tokenAddress: '',
  },
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'USDT',
    symbol: 'USDT',
    order: 2,
    tokenAddress: '',
  },
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'Aave Token',
    symbol: 'AAVE',
    order: 2,
    tokenAddress: '',
  },
  {
    maticChainUsdBalance: '1.8',
    maticChainBalance: '0',
    name: 'Matic Token',
    symbol: 'MATIC',
    order: 1,
    tokenAddress: '',
  },
];

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
            await deriveAccounts(screenMnemonic, DEFAULT_ACCOUNT_NUM)
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

export default function Wallet() {
  const [tokens, setTokens] = useState(
    initialTokenState.sort((a, b) => Number(a.order) - Number(b.order)),
  );
  const [state] = useContext(UserContext);
  const [modalShow, setModalShow] = useState(false);

  useEffect(async () => {
    const pkdsDerived = Storage.pkdArrayGet(await Web3.getAccount());
    console.log('pkdsDerived', pkdsDerived);
    if (typeof state.compressedPkd === 'undefined' && !pkdsDerived) setModalShow(true);
    else setModalShow(false);
    console.log('SSTAETE', state);
  }, []);

  useEffect(async () => {
    const l2Balance = await getWalletBalance(state.compressedPkd);
    const { address: newTokenAddress } = (await getContractAddress('ERC20Mock')).data; // TODO This is just until we get a list from Polygon
    const updatedTokenState = initialTokenState.map(i => {
      const { tokenAddress, ...rest } = i;
      if (i.symbol === 'MATIC')
        // TODO just map the mock address over the MATIC token.
        return {
          tokenAddress: newTokenAddress,
          ...rest,
        };
      return i;
    });
    if (
      Object.keys(l2Balance).length !== 0 &&
      Object.prototype.hasOwnProperty.call(state, 'compressedPkd')
    ) {
      // eslint-disable-next-line consistent-return, array-callback-return
      const updatedState = updatedTokenState.map(t => {
        if (Object.keys(l2Balance).includes(state.compressedPkd)) {
          const token = l2Balance[state.compressedPkd][t.tokenAddress.toLowerCase()];
          const tokenInfo = t;
          if (token) {
            const { maticChainBalance, ...rest } = tokenInfo;
            return {
              maticChainBalance: token.toString(),
              ...rest,
            };
          }
          return t;
        }
      });
      if (typeof updatedState[0] === 'undefined') return;
      const newState = updatedTokenState.map(i => {
        const s = updatedState.find(u => i.symbol === u.symbol);
        if (s) return s;
        return i;
      });
      setTokens(newState.sort((a, b) => Number(a.order) - Number(b.order)));
    } else {
      setTokens(updatedTokenState.sort((a, b) => Number(a.order) - Number(b.order)));
    }
  }, [state.compressedPkd]);

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
            <Tokens tokenList={tokens} />
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
