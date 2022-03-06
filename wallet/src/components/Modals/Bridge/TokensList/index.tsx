import React, { useState, Dispatch, SetStateAction, ChangeEvent } from 'react';
import "./styles.scss";
import { AiOutlineClose } from 'react-icons/ai'
import { FiSearch } from 'react-icons/fi';
import tokensList from './tokensList';
import Modal from 'react-bootstrap/Modal';

type TokenListType = {
  handleClose: Dispatch<SetStateAction<boolean>>;  
}

const TokensList = ({ handleClose }: TokenListType) => {    

  const [filteredTokens, setFilteredTokens] = useState(tokensList.tokens);
  
  const filterTokens = (e: ChangeEvent<HTMLInputElement>) => {
    setFilteredTokens(tokensList.tokens.filter(token => token.name.toLowerCase().includes(e.target.value.toLocaleLowerCase())));    
    console.log("E: ",e.target.value);
  }

  return (
    <div>
      <Modal className="modal_wrapper" show={true} onHide={() => handleClose(false)}>
        <Modal.Header closeButton>
          <div className="tokens_itens_modal_header">          
            <p className="tokens_itens_modal_title">Tokens List</p>                    
          </div>
        </Modal.Header>
        <Modal.Body>        
          <p className="input_search_title">Choose token from <span>Ethereum</span></p>
          <div className="input_wrapper">
            <FiSearch />
            <input 
              type="text" 
              placeholder="Search here"
              onChange={(e) => filterTokens(e)}
            />
          </div>      
          <ul className="tokens_list">
            {filteredTokens.map((token: any, index: number) => (
              <li className="tokens_line" key={index}>
                <div>
                  <img src={token.logoURI} alt="token image" />
                  <p>{token.name}</p>
                </div>
                <p>Balance</p>
              </li>
            ))}          
          </ul>
        </Modal.Body>
      </Modal>    
    </div>
  )
}

export default TokensList;