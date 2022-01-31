import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import jsSha3 from 'js-sha3';
import PropTypes from 'prop-types';
import Button from 'react-bootstrap/Button';
import { generateMnemonic } from 'bip39';
import * as Nf3 from 'nf3';
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
import styles from '../../styles/wallet.module.scss';
import * as Storage from '../../utils/lib/local-storage';
import { METAMASK_MESSAGE, DEFAULT_NF_ADDRESS_INDEX } from '../../constants.js';
import { UserContext } from '../../hooks/User/index.jsx';
import { generateKeys } from '../../nightfall-browser/services/keys.js';
import blockProposedEventHandler from '../../nightfall-browser/event-handlers/block-proposed.js';

/*
These are some default values for now
*/
const tokenMapping = {
  '0xf05e9fb485502e5a93990c714560b7ce654173c3': {
    name: 'Matic Token',
    tokenType: 'ERC20',
    maticChainUsdBalance: '1.8',
    maticChainBalance: '10',
    symbol: 'MATIC',
    tokenAddress: '0xf05e9fb485502e5a93990c714560b7ce654173c3',
  },
};

// const compressedPkd = '0x9e989c1cdde6b046489665f71799783935c96574e94d85654c45b440c06b796d';
const initialTokenState = [
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'ChainLink Token',
    symbol: 'LINK',
    order: 2,
    tokenAddress: '0xf05e9fb485502e5a93990c714560b7ce654173c3',
  },
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'USDT',
    symbol: 'USDT',
    order: 2,
    tokenAddress: '0xf05e9fb485502e5a93990c714560b7ce654173c3',
  },
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'Aave Token',
    symbol: 'AAVE',
    order: 2,
    tokenAddress: '0xf05e9fb485502e5a93990c714560b7ce654173c3',
  },
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'Matic Token',
    symbol: 'MATIC',
    order: 1,
    tokenAddress: '0xf05e9fb485502e5a93990c714560b7ce654173c3',
  },
];

/**
This is a modal to detect if a wallet (mnemonic and passphrase) has been initialized
*/

function WalletModal(props) {
  const [state, setState] = React.useContext(UserContext);
  const [screenMnemonic, setScreenMnemonic] = React.useState();
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
        <Container>
          {[0, 1].map((r, key) => (
            // eslint-disable-next-line react/jsx-key
            <Row key={key}>
              {[0, 1, 2, 3, 4, 5].map((c, innerKey) => (
                // eslint-disable-next-line react/jsx-key
                <Col key={innerKey}>
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
            const signature = await state.nf3.signMessage(
              METAMASK_MESSAGE,
              state.nf3.ethereumAddress,
            );
            const hashedSignature = jsSha3.keccak256(signature);
            Storage.mnemonicSet(state.nf3.ethereumAddress, screenMnemonic, hashedSignature);
            setState({
              nf3: state.nf3,
              mnemonic: screenMnemonic,
              walletInitialised: true,
              socket: state.socket,
              zkpKeys: state.zkpKeys,
            });
            props.onHide();
          }}
          disabled={
            typeof state.nf3 === 'undefined' || typeof state.nf3.ethereumAddress === 'undefined'
          }
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
  const [state, setState] = React.useContext(UserContext);
  const [modalShow, setModalShow] = React.useState(false);

  useEffect(() => {
    async function setupNF3() {
      if (!state.nf3) {
        const nf3Env = Nf3.Environment.getCurrentEnvironment().currentEnvironment;
        const nf3 = await new Nf3.Nf3(nf3Env.web3WsUrl, '', nf3Env);
        await nf3.init();
        Nf3.Environment.setContractAddresses(nf3);
        setState({
          zkpKeys: state.zkpKeys,
          walletInitialised: state.walletInitialised,
          mnemonic: state.mnemonic,
          socket: state.socket,
          nf3,
        });
      }
    }
    setupNF3();
  }, []);

  useEffect(() => {
    async function checkWalletExists() {
      if (state.nf3) {
        const mnemonicExists = Storage.mnemonicGet(state.nf3.ethereumAddress);
        if (mnemonicExists) state.walletInitialised = true;
        if (state.walletInitialised) {
          if (typeof state.mnemonic !== 'undefined') {
            const zkpKeys = await generateKeys(
              state.mnemonic,
              `m/44'/60'/0'/${DEFAULT_NF_ADDRESS_INDEX.toString()}`,
            );
            state.zkpKeys = zkpKeys;
          } else {
            const signature = await state.nf3.signMessage(
              METAMASK_MESSAGE,
              state.nf3.ethereumAddress,
            );
            const passphrase = jsSha3.keccak256(signature);
            state.mnemonic = Storage.mnemonicGet(state.nf3.ethereumAddress, passphrase);
            const zkpKeys = await generateKeys(
              state.mnemonic,
              `m/44'/60'/0'/${DEFAULT_NF_ADDRESS_INDEX.toString()}`,
            );
            state.zkpKeys = zkpKeys;
          }
          setState({
            zkpKeys: state.zkpKeys,
            walletInitialised: state.walletInitialised,
            nf3: state.nf3,
            mnemonic: state.mnemonic,
            socket: state.socket,
          });
        } else setModalShow(true);
      } else console.log('NF3 is not setup');
    }
    checkWalletExists();
  }, [state.mnemonic, state.nf3]);

  useEffect(() => {
    if (typeof state.socket === 'undefined' && typeof state.zkpKeys !== 'undefined') {
      const socket = new WebSocket('ws://localhost:8082');
      // Connection opened
      socket.addEventListener('open', function () {
        console.log(`Websocket is open`);
        socket.send('proposedBlock');
      });

      // Listen for messages
      socket.addEventListener('message', async function (event) {
        console.log('Message from server ', event.data);
        await blockProposedEventHandler(
          JSON.parse(event.data),
          state.zkpKeys.ivk,
          state.zkpKeys.nsk,
        );
      });
      setState({
        zkpKeys: state.zkpKeys,
        walletInitialised: state.walletInitialised,
        nf3: state.nf3,
        mnemonic: state.mnemonic,
        socket,
      });
    }
  });

  useEffect(() => {
    async function getL2Balance() {
      const l2Balance = await getWalletBalance();
      if (
        Object.keys(l2Balance).length !== 0 &&
        Object.prototype.hasOwnProperty.call(state, 'zkpKeys')
      ) {
        // eslint-disable-next-line consistent-return, array-callback-return
        const updatedState = Object.keys(tokenMapping).map(t => {
          if (Object.keys(l2Balance).includes(state.zkpKeys.compressedPkd)) {
            const token = l2Balance[state.zkpKeys.compressedPkd][t];
            const tokenInfo = tokenMapping[t];
            if (token) {
              const { maticChainBalance, ...rest } = tokenInfo;
              return {
                maticChainBalance: token.toString(),
                ...rest,
              };
            }
          }
        });
        if (typeof updatedState[0] === 'undefined') return;
        const newState = initialTokenState.map(i => {
          const s = updatedState.find(u => i.symbol === u.symbol);
          if (s) return s;
          return i;
        });
        setTokens(newState.sort((a, b) => Number(a.order) - Number(b.order)));
      }
    }
    getL2Balance();
  }, [state.zkpKeys]);

  return (
    <div className={styles.wallet}>
      <Header />
      <div className={styles.walletComponents}>
        <div className={styles.walletComponents__left}>
          <SideBar />
        </div>
        <div>
          <WalletModal show={modalShow} onHide={() => setModalShow(false)} />
        </div>
        <div className={styles.walletComponents__right}>
          <Assets tokenList={tokens} />
          <Tokens tokenList={tokens} />
        </div>
      </div>
    </div>
  );
}

WalletModal.propTypes = {
  onHide: PropTypes.func.isRequired,
};
