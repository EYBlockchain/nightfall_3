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
import { useAccount } from '../../hooks/Account/index.tsx';
import tokensList from '../../components/Modals/Bridge/TokensList/tokensList';
import { getContractAddress } from '../../common-files/utils/contract.js';
import getPrice from '../../utils/pricingAPI';
/*
These are some default values for now
*/

// const initialTokenState = [
//   {
//     maticChainUsdBalance: '0',
//     maticChainBalance: '0',
//     name: 'ChainLink Token',
//     symbol: 'LINK',
//     order: 2,
//     tokenAddress: '',
//   },
//   {
//     maticChainUsdBalance: '0',
//     maticChainBalance: '0',
//     name: 'USDT',
//     symbol: 'USDT',
//     order: 2,
//     tokenAddress: '',
//   },
//   {
//     maticChainUsdBalance: '0',
//     maticChainBalance: '0',
//     name: 'Aave Token',
//     symbol: 'AAVE',
//     order: 2,
//     tokenAddress: '',
//   },
//   {
//     maticChainUsdBalance: '1.8',
//     maticChainBalance: '0',
//     name: 'Matic Token',
//     symbol: 'MATIC',
//     order: 1,
//     tokenAddress: '',
//   },
// ];

/**
This is a modal to detect if a wallet (mnemonic and passphrase) has been initialized
*/

function WalletModal(props) {
  const [, , configureMnemonic] = useContext(UserContext);
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
            await configureMnemonic(screenMnemonic);
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
  const { setAccountInstance } = useAccount();
  const initialTokenState = tokensList.tokens.map(t => {
    return {
      l2Balance: '0',
      currencyValue: 0,
      ...t,
    };
  });
  const [tokens, setTokens] = useState(initialTokenState);
  const [state] = useContext(UserContext);
  const [modalShow, setModalShow] = useState(false);

  useEffect(async () => {
    const web3 = Web3.connection();
    const accounts = await web3.eth.getAccounts();
    setAccountInstance({
      address: accounts[0],
    });
  }, []);

  useEffect(async () => {
    const mnemonicExists = Storage.mnemonicGet(await Web3.getAccount());
    if (typeof state.mnemonic === 'undefined' && !mnemonicExists) setModalShow(true);
    else setModalShow(false);
  }, [state.mnemonic]);

  useEffect(async () => {
    const pkd = Storage.pkdGet(await Web3.getAccount());
    const l2BalanceObj = await getWalletBalance(pkd);
    const updatedState = await Promise.all(
      tokens.map(async t => {
        const currencyValue = await getPrice(t.id);
        if (Object.keys(l2BalanceObj).includes(pkd)) {
          console.log('l2Balance', l2BalanceObj);
          const token = l2BalanceObj[pkd][t.address.toLowerCase()] ?? 0;
          console.log('Token', token);
          return {
            ...t,
            l2Balance: token.toString(),
            currencyValue,
          };
        }
        return t;
      }),
    );
    // Trapdoor for testing
    const { address: trapdoorAddress } = (await getContractAddress('ERC20Mock')).data; // TODO Only for testing now
    setTokens(
      updatedState.map(({ address, ...rest }) => {
        return {
          ...rest,
          address: trapdoorAddress,
        };
      }),
    );
  }, []);

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
