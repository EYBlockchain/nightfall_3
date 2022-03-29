import React, { useState, Dispatch, SetStateAction, ChangeEvent } from 'react';
import { FiSearch } from 'react-icons/fi';
import Modal from 'react-bootstrap/Modal';
import PropTypes from 'prop-types';

import "./styles.scss";
import styled from 'styled-components';
import matic from '../../../../assets/svg/matic.svg';
import { MdArrowForwardIos } from 'react-icons/md';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Dropdown from 'react-bootstrap/Dropdown';
import { ModalBody } from 'react-bootstrap';

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

const TokenDetailsUsd = styled.div`    
  margin-top: 10px;
  color: $light-gray-600;
  font-size: small;  
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

// type TokenListType = {
//   handleClose: Dispatch<SetStateAction<boolean>>;  
//   transferValue: number;
// }

const TransferModal = ({ show, setShow, handleClose, transferValue, txType, setMethod, transferMethod, handleShowModalConfirm }) => {    
    

  return (
    <Modal contentClassName="modalFather" show={show} onHide={() => setShow(false)}>
      <Modal.Header closeButton>
        <div className="modalTitle">Confirm transaction</div>
      </Modal.Header>
      <ModalBody>
        <MyModalBody>
          <div className="tokenDetails">
            {/* d-flex justify-content-center align-self-center mx-auto */}
            <div className="tokenDetails__img">
              {/* <img
                              v-if="
                              selectedToken.symbol &&
                                  !!tokenImage(selectedToken)
                              "
                              class="align-self-center"
                              :src="tokenImage(selectedToken)"
                              alt="Token Image"
                          > */}
              <img src={matic} alt="Token" />
              {/* <span
                              v-else-if="selectedToken.symbol"
                              class="align-self-center font-heading-large ps-t-2 font-semibold"
                          >{{ selectedToken.symbol[0] }}</span> */}
            </div>
            {/* font-heading-large font-bold ps-t-16 ps-b-6 */}
            <TokenDetailsVal id="Bridge_modal_tokenAmount">
              {
                Number(transferValue)
                  .toString()
                  .match(/^-?\d+(?:\.\d{0,4})?/)[0]
              }
            </TokenDetailsVal>
            {/* font-body-small */}
            <TokenDetailsUsd>$xx.xx</TokenDetailsUsd>
          </div>

          {/* Buttons */}
          <div>
            <NetworkButtons>
              <Button1>
                <span>
                  {txType === 'deposit' ? 'Ethereum Mainnet' : 'Polygon Nightfall L2'}
                </span>
              </Button1>
              <MdArrowForwardIos />
              <Button2>
                <span>
                  {txType === 'deposit' ? 'Polygon Nightfall L2' : 'Ethereum Mainnet'}
                </span>
              </Button2>
            </NetworkButtons>
          </div>
          <Divider />
          <TransferMode>
            <TransferModeTitle>
              <TransferModeTitleMain>Transfer Mode</TransferModeTitleMain>
              <TransferModeTitleLight>
                <DropdownButton
                  variant="light"
                  title={transferMethod}
                  id="Bridge_modal_transferMode"
                >
                  <Dropdown.Item onClick={() => setMethod('On-Chain')}>On-Chain</Dropdown.Item>
                  <Dropdown.Item onClick={() => setMethod('Direct Transfer')}>
                    Direct Transfer
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => setMethod('Instant Withdrawal')}>
                    Instant Withdrawal
                  </Dropdown.Item>
                </DropdownButton>
              </TransferModeTitleLight>
            </TransferModeTitle>
            <TransferModeText>
              <span>Transfer security is provided by the Ethereum miners.</span>
              {/* <span v-else>
                          Plasma provides advanced security with plasma exit
                          mechanism. </span>It will take approximately */}
              <span>
                {' '}
                To minimise the risk of chain reorganisations, your transfer will wait for{' '}
              </span>
              <span className="text-primary"> 12 block confirmations</span> before being
              finalized.
            </TransferModeText>
          </TransferMode>
          <Divider />
          <EstimationFee>
            <EstimationFeeTitle>
              <EstimationFeeTitleMain>
                Estimation Transaction fee
              </EstimationFeeTitleMain>
              <EstimationFeeTitleLight>~ $x.xx</EstimationFeeTitleLight>
            </EstimationFeeTitle>
            <ContinueTransferButton
              type="button"              
              // onClick={() => triggerTx()}
              onClick={() => {
                handleClose();
                handleShowModalConfirm();
              }}
            >
              Create Transaction
            </ContinueTransferButton>
          </EstimationFee>
        </ MyModalBody>
      </ ModalBody>
    </Modal>
  )
}

export default TransferModal;

TransferModal.propTypes = {
  handleClose: PropTypes.func.isRequired,
  transferValue: PropTypes.number.isRequired,
  txType: PropTypes.string.isRequired,
  setMethod: PropTypes.func.isRequired,
  transferMethod: PropTypes.string.isRequired,
  handleShowModalConfirm: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
  setShow: PropTypes.func.isRequired
};