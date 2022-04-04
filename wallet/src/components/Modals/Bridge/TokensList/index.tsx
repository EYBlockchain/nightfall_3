import React, { useState, Dispatch, SetStateAction, ChangeEvent } from 'react';
import { FiSearch } from 'react-icons/fi';
import tokensList from './tokensList';
import Modal from 'react-bootstrap/Modal';
import TokenType from './TokenType';
import styled from 'styled-components';

const Header = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
`;

const HeaderText = styled.div `
  left: 17.08%;
  right: 16.18%;
  top: 36.36%;
  bottom: 36.36%;  

  /* Header/H5 */

  fontFamily: Manrope;
  fontStyle: normal;
  fontWeight: 800;
  fontSize: 16px;  
  /* identical to box height; or 150% */

  textAlign: center;
  letterSpacing: 0.01em;
  color: #061024;
`;

const MyModalBody = styled.div`  
  overflow: auto;
  max-height: 600px;
`;

const MyModalBodyText = styled.div`
  height: 44px;
  width: 100%;
  padding: 24px 32px;
  /* Header/H2 */
  
  font-family: Manrope;
  font-style: normal;
  font-weight: 800;
  font-size: 26px;
  
  /* identical to box height, or 122% */
  
  letter-spacing: -0.01em;
  
  /* light/gray-900 */
  
  color: #0A0B0D;
`;

const SearchBox = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  padding: 32px;
`;

const MyModalBodySpan = styled.span`
  color: #7B3FE4;
  margin-left: 7px;
`;

const TokenUl = styled.ul`
    padding-right: 24px;
  `;

const TokenLi = styled.li`
  width: 100%;
  
  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 80px;
  border-bottom: 1px solid #F3F4F7;
  padding: 10px;

  &:hover {
    cursor: pointer;
    background: #ddd;
  }
`;

const SearchInput = styled.input`
  border: 0px;
  margin-left: 10px;

  &::placeholder {
    font-family: Manrope;
    font-style: normal;
    font-weight: 500;
    font-size: 14px;
    line-height: 24px;
    /* identical to box height, or 171% */

    display: flex;
    align-items: flex-end;

    color: #000000;

    opacity: 0.5;
  }    

  &:focus {
    outline: none;
  }
`;

const LiWrapper = styled.div`
  display: flex;
  align-items: center;

  img {
    margin-right: 12px;
    width: 40px;
    height: 40px;
  }

  p {
    margin-top: 17px;
  }
`

type TokenListType = {
  handleClose: Dispatch<SetStateAction<boolean>>;
  setToken: Dispatch<SetStateAction<TokenType>>;
}

const TokensList = ({ handleClose, setToken }: TokenListType) => {    

  const [filteredTokens, setFilteredTokens] = useState(tokensList.tokens);
  
  const filterTokens = (e: ChangeEvent<HTMLInputElement>) => {
    setFilteredTokens(tokensList.tokens.filter(token => token.name.toLowerCase().includes(e.target.value.toLocaleLowerCase())));    
    console.log("E: ",e.target.value);
  }

  const handleTokenSelection = (token: any) => {    
    setToken(token);
    handleClose(false);
  }  

  return (
    <div>
      <Modal         
        show={true} 
        onHide={() => handleClose(false)}
      >
        <Modal.Header closeButton style={{ padding: "35px" }}>
          <Header>                   
              <HeaderText>Tokens List</HeaderText>                                
          </Header>
        </Modal.Header>
        <Modal.Body>           
          <MyModalBody>
            <MyModalBodyText>
              Choose token from 
              <MyModalBodySpan>Ethereum</MyModalBodySpan>
            </MyModalBodyText>
            <SearchBox>
              <FiSearch />
              <SearchInput 
                type="text" 
                placeholder="Search here"
                onChange={(e) => filterTokens(e)}
              />
            </SearchBox>                
            <TokenUl>
              {filteredTokens.map((token: any, index: number) => (
                <TokenLi                
                  key={index} 
                  onClick={() => handleTokenSelection(token)}
                >
                  <LiWrapper>
                    <img src={token.logoURI} alt={`${token.name} token`} />
                    <p>{token.name}</p>
                  </LiWrapper>
                  <p>Balance</p>
                </TokenLi>
              ))}          
            </TokenUl>
          </MyModalBody>
        </Modal.Body>
      </Modal>    
    </div>
  )
}

export default TokensList;
