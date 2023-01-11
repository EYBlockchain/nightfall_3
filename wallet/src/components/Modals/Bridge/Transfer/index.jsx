import React from 'react';
import Modal from 'react-bootstrap/Modal';
import PropTypes from 'prop-types';

import './styles.scss';
import styled from 'styled-components';
import { MdArrowForwardIos } from 'react-icons/md';
import { ModalBody } from 'react-bootstrap';
import matic from '../../../../assets/svg/matic.svg';
import { ChainIdMapping } from '../../../../common-files/utils/web3';

const MyModalBody = styled.div`
  flex-direction: column;
  text-align: center;
  padding: 10px;
`;

const TokenDetailsVal = styled.div`
  margin-top: 20px;
  font-size: x-large;
  font-weight: bold;
`;

const NetworkButtons = styled.div`
  padding-top: 30px;
  display: flex;
  flex-direction: row;
  align-items: center;
  font-size: small;
`;

const Button1 = styled.div`
  padding: 10px;
  background-color: #bbb6f363;
  border-radius: 15px;
  margin-right: 15px;
  width: 70%;
`;

const Button2 = styled.div`
  padding: 10px;
  background-color: #b7b1f5ad;
  border-radius: 15px;
  margin-left: 15px;
  width: 70%;
`;

const Divider = styled.div`
  margin-top: 30px;
  border-bottom: solid 1px #ddd;
`;

const TransferMode = styled.div`
  margin-top: 24px;
`;

const TransferModeTitle = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const TransferModeTitleMain = styled.div`
  font-size: large;
  font-weight: bold;
`;

const TransferModeTitleLight = styled.div`
  font-size: medium;
  color: $light-gray-600;
`;

const TransferModeText = styled.div`
  font-size: small;
  text-align: start;
`;

const EstimationFee = styled.div`
  margin-top: 24px;
`;

const EstimationFeeTitle = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const EstimationFeeTitleMain = styled.div`
  font-size: large;
  font-weight: bold;
`;

const EstimationFeeTitleLight = styled.div`
  font-size: medium;
  color: $light-gray-600;
`;

const ContinueTransferButton = styled.button`
  margin-top: 12px;
  border-radius: 12px;
  align-self: flex-end;
  width: 100%;
  background-color: #7b3fe4;
  color: #fff;
  padding: 15px;
  margin-bottom: 12px;

  &:hover {
    cursor: pointer;
  }
`;

const { ethereum } = global;
const targetEnv = process.env.REACT_APP_MODE.replace('-', '_');

const TransferModal = ({ show, handleClose, transferValue, txType, triggerTx, setReadyTx }) => {
  return (
    <Modal contentClassName="modalFather" show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <div className="modalTitle">Confirm transaction</div>
      </Modal.Header>
      <ModalBody>
        <MyModalBody>
          <div className="tokenDetails">
            <div className="tokenDetails__img">
              <img src={matic} alt="Token" />
            </div>
            <TokenDetailsVal id="Bridge_modal_tokenAmount">
              {
                Number(transferValue)
                  .toString()
                  .match(/^-?\d+(?:\.\d{0,4})?/)[0]
              }
            </TokenDetailsVal>
          </div>

          {/* Buttons */}
          <div>
            <NetworkButtons>
              <Button1>
                <span>{txType === 'deposit' ? 'Ethereum Mainnet' : 'Nightfall L2'}</span>
              </Button1>
              <MdArrowForwardIos />
              <Button2>
                <span>{txType === 'deposit' ? 'Nightfall L2' : 'Ethereum Mainnet'}</span>
              </Button2>
            </NetworkButtons>
          </div>
          <Divider />
          <TransferMode>
            <TransferModeTitle>
              <TransferModeTitleMain>Transfer Mode</TransferModeTitleMain>
              <TransferModeTitleLight>
                {txType === 'deposit' ? 'On-Chain' : 'Direct Transfer'}
              </TransferModeTitleLight>
            </TransferModeTitle>
            <TransferModeText>
              <span>Transfer security is provided by the Ethereum miners.</span>
              <span>
                {' '}
                To minimise the risk of chain reorganisations, your transfer will wait for{' '}
              </span>
              <span className="text-primary"> 12 block confirmations</span> before being finalised.
            </TransferModeText>
          </TransferMode>
          <Divider />
          <EstimationFee>
            <EstimationFeeTitle>
              <EstimationFeeTitleMain>Estimated Nightfall Fee</EstimationFeeTitleMain>
              <EstimationFeeTitleLight>Free</EstimationFeeTitleLight>
            </EstimationFeeTitle>
            {txType === 'withdraw' ||
            (txType === 'deposit' && ethereum.chainId === ChainIdMapping[targetEnv].chainId) ? (
              <ContinueTransferButton
                type="button"
                onClick={async () => {
                  handleClose();
                  setReadyTx(await triggerTx());
                }}
              >
                Create Transaction
              </ContinueTransferButton>
            ) : (
              <ContinueTransferButton
                type="button"
                style={{ backgroundColor: 'grey' }}
                onClick={() => {
                  return ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: ChainIdMapping[targetEnv].chainId }], // chainId must be in hexadecimal numbers
                  });
                }}
              >
                Switch to {ChainIdMapping[targetEnv].chainName} For Deposits.
              </ContinueTransferButton>
            )}
          </EstimationFee>
        </MyModalBody>
      </ModalBody>
    </Modal>
  );
};

export default TransferModal;

TransferModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
  transferValue: PropTypes.string.isRequired,
  txType: PropTypes.string.isRequired,
  show: PropTypes.bool.isRequired,
  setShow: PropTypes.func.isRequired,
  triggerTx: PropTypes.func.isRequired,
  setReadyTx: PropTypes.func.isRequired,
};
