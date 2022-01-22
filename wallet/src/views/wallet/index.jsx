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

/*
These are some default values for now
*/
const tokenMapping = {
  '0xf05e9fb485502e5a93990c714560b7ce654173c3': {
    name: 'Matic Token',
    tokenType: 'ERC20',
    maticChainUsdBalance: '20',
    maticChainBalance: '10',
    symbol: 'MATIC',
  },
};

const compressedPkd = '0xa4f0567cec890e2f61c696f8f4005245774b08bb6bbd47495f861394e4b68a53';
const initialTokenState = [
  {
    maticChainUsdBalance: '100',
    maticChainBalance: '10',
    name: 'ChainLink Token',
    symbol: 'LINK',
  },
  {
    maticChainUsdBalance: '100',
    maticChainBalance: '10',
    name: 'USDT',
    symbol: 'USDT',
  },
  {
    maticChainUsdBalance: '100',
    maticChainBalance: '10',
    name: 'Aave Token',
    symbol: 'AAVE',
  },
  {
    maticChainUsdBalance: '100',
    maticChainBalance: '10',
    name: 'Matic Token',
    symbol: 'MATIC',
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
            setState({ nf3: state.nf3, mnemonic: state.mnemonic, walletInitialised: true });
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
  const [tokens, setTokens] = useState(initialTokenState);
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
        setState({ nf3 });
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
          const signature = await state.nf3.signMessage(
            METAMASK_MESSAGE,
            state.nf3.ethereumAddress,
          );
          const passphrase = jsSha3.keccak256(signature);
          const mnemonic = Storage.mnemonicGet(state.nf3.ethereumAddress, passphrase);
          const zkpKeys = await generateKeys(
            mnemonic,
            `m/44'/60'/0'/${DEFAULT_NF_ADDRESS_INDEX.toString()}`,
          );
          // const currentState = state;
          setState({
            zkpKeys,
            walletInitialised: state.walletInitialised,
            nf3: state.nf3,
            mnemonic,
          });
        } else setModalShow(true);
      } else console.log('NF3 is not setup');
    }
    checkWalletExists();
  }, [state.nf3]);

  useEffect(() => {
    async function getL2Balance() {
      const l2Balance = await getWalletBalance();
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
      setTokens(newState.sort((a, b) => Number(b.maticChainBalance) - Number(a.maticChainBalance)));
    }
    getL2Balance();
  }, []);

  return (
    <div className={styles.wallet}>
      <div>
        <WalletModal show={modalShow} onHide={() => setModalShow(false)} />
      </div>
      <Assets />
      <Tokens tokenList={tokens} />
    </div>
  );
}

WalletModal.propTypes = {
  onHide: PropTypes.func.isRequired,
};
