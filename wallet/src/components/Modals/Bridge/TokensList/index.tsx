import React, { useState, Dispatch, SetStateAction, ChangeEvent } from 'react';
import { FiSearch } from 'react-icons/fi';
import tokensList from './tokensList';
import Modal from 'react-bootstrap/Modal';
import TokenType from './TokenType';
import "./styles.scss";
import styled from 'styled-components';

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

  return (
    <div>
      <Modal 
        style={{
          WebkitBorderRadius: "0px",
          MozBorderRadius: "0px",
          borderRadius: "20px",     
        }} 
        show={true} 
        onHide={() => handleClose(false)}
      >
        <Modal.Header
          style={{
            padding: "12px 32px",            
          }}                    
        >
          <div 
            style={{                
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%"               
            }}
          >          
            <p 
              style={{
                left: "17.08%",
                right: "16.18%",
                top: "36.36%",
                bottom: "36.36%",

                margin: "32px 0",

                /* Header/H5 */

                fontFamily: "Manrope",
                fontStyle: "normal",
                fontWeight: "800",
                fontSize: "16px",  
                /* identical to box height, or 150% */

                textAlign: "center",
                letterSpacing: "0.01em",

                /* Dark_Gray_700 */

                color: "#061024",
              }}
            >Tokens List</p>                    
          </div>
        </Modal.Header>
        <Modal.Body 
          style={{ 
            overflow: "auto",            
            maxHeight: "600px"
          }}
        >           
        <p style={{
            height: "44px",
            width: "100%",
            padding: "24px 32px",
            /* Header/H2 */
            
            fontFamily: "Manrope",
            fontStyle: "normal",
            fontWeight: "800",
            fontSize: "26px",  
            
            /* identical to box height, or 122% */
            
            letterSpacing: "-0.01em",
            
            /* light/gray-900 */
            
            color: "#0A0B0D"
          }}>
            Choose token from 
            <span 
              style={{ color: "#7B3FE4", marginLeft: "7px" }}
            >Ethereum</span>
          </p>
          <div 
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
              width: "100%",
              padding: "32px",              
            }}
          >
            <FiSearch />
            <SearchInput 
              type="text" 
              placeholder="Search here"
              onChange={(e) => filterTokens(e)}
            />
          </div>                
          <ul 
            style={{
              paddingRight: "24px",
            }} 
          >
            {filteredTokens.map((token: any, index: number) => (
              <TokenLi                
                key={index} 
                onClick={() => handleTokenSelection(token)}
              >
                <div 
                  style={{
                    display: "flex",
                    alignItems: "center" 
                  }}
                >
                  <img 
                    style={{
                      marginRight: "12px",
                      width: "40px",
                      height: "40px"
                    }}
                    src={token.logoURI} alt={`${token.name} token`} />
                  <p style={{ marginTop: "17px" }}>{token.name}</p>
                </div>
                <p>Balance</p>
              </TokenLi>
            ))}          
          </ul>
        </Modal.Body>
      </Modal>    
    </div>
  )
}

export default TokensList;