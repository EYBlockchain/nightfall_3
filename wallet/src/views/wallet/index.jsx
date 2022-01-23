import React, { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import jsSha3 from 'js-sha3';
import PropTypes from 'prop-types';
import Button from 'react-bootstrap/Button';
import { generateMnemonic } from 'bip39';
import * as Nf3 from 'nf3';
import Assets from '../../components/Assets/index.jsx';
import Tokens from '../../components/Tokens/index.jsx';
import { getWalletBalance } from '../../nightfall-browser/services/commitment-storage.js';
import styles from '../../styles/wallet.module.scss';
import * as Storage from '../../utils/lib/local-storage';
import { METAMASK_MESSAGE, DEFAULT_NF_ADDRESS_INDEX } from '../../constants.js';
import { UserContext } from '../../hooks/User';
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
  },
};

const compressedPkd = '0x9e989c1cdde6b046489665f71799783935c96574e94d85654c45b440c06b796d';
const initialTokenState = [
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'ChainLink Token',
    symbol: 'LINK',
    order: 2,
  },
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'USDT',
    symbol: 'USDT',
    order: 2,
  },
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'Aave Token',
    symbol: 'AAVE',
    order: 2,
  },
  {
    maticChainUsdBalance: '0',
    maticChainBalance: '0',
    name: 'Matic Token',
    symbol: 'MATIC',
    order: 1,
  },
];

/**
This is a modal to detect if a wallet (mnemonic and passphrase) has been initialized
*/

function WalletModal(props) {
  const [state, setState] = React.useContext(UserContext);
  return (
    <Modal {...props} size="lg" aria-labelledby="contained-modal-title-vcenter" centered>
      <Modal.Header closeButton>
        <Modal.Title id="contained-modal-title-vcenter">Modal heading</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h4>Centered Modal</h4>
        <p>
          Cras mattis consectetur purus sit amet fermentum. Cras justo odio, dapibus ac facilisis
          in, egestas eget quam. Morbi leo risus, porta ac consectetur ac, vestibulum at eros.
          {state.mnemonic}
        </p>
        <Button
          onClick={() =>
            setState({
              nf3: state.nf3,
              walletInitialised: state.walletInitialised,
              mnemonic: generateMnemonic(),
              socket: state.socket,
              zkpKeys: state.zkpKeys,
            })
          }
        >
          Generate Mnemonic
        </Button>
      </Modal.Body>
      <Modal.Footer>
        <Button
          onClick={async () => {
            const signature = await state.nf3.signMessage(
              METAMASK_MESSAGE,
              state.nf3.ethereumAddress,
            );
            const hashedSignature = jsSha3.keccak256(signature);
            Storage.mnemonicSet(state.nf3.ethereumAddress, state.mnemonic, hashedSignature);
            setState({
              nf3: state.nf3,
              mnemonic: state.mnemonic,
              walletInitialised: true,
              socket: state.socket,
              zkpKeys: state.zkpKeys,
            });
            props.onHide();
          }}
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
        console.log('Preinit nf3', nf3);
        await nf3.init();
        Nf3.Environment.setContractAddresses(nf3);
        console.log('nf3', nf3);
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
    console.log('State Socket', state);
    if (!state.socket) {
      const socket = new WebSocket('ws://localhost:8082');

      // Connection opened
      socket.addEventListener('open', function () {
        console.log(`Websocket is open`);
        socket.send('proposedBlock');
      });

      // Listen for messages
      socket.addEventListener('message', async function (event) {
        console.log('Message from server ', event.data);
        await blockProposedEventHandler(JSON.parse(event.data));
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
    async function checkWalletExists() {
      if (state.nf3) {
        const mnemonicExists = Storage.mnemonicGet(state.nf3.ethereumAddress);
        if (mnemonicExists) state.walletInitialised = true;
        if (state.walletInitialised) {
          if (state.mnemonic) {
            console.log('State Mnemonic', state.mnemonic);
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
          console.log('State After Wallet is created', state);
        } else setModalShow(true);
      } else console.log('NF3 is not setup');
    }
    checkWalletExists();
  }, [state.nf3]);

  useEffect(() => {
    async function getL2Balance() {
      const l2Balance = await getWalletBalance();
      console.log('L2Balance', l2Balance);
      if (Object.keys(l2Balance).length !== 0) {
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
        setTokens(newState.sort((a, b) => Number(a.order) - Number(b.order)));
        console.log('tokens', tokens);
      }
    }
    getL2Balance();
  }, []);

  return (
    <div className={styles.wallet}>
      <div>
        <WalletModal show={modalShow} onHide={() => setModalShow(false)} />
      </div>
      <Assets tokenList={tokens} />
      <Tokens tokenList={tokens} />
    </div>
  );
}

WalletModal.propTypes = {
  onHide: PropTypes.func.isRequired,
};
