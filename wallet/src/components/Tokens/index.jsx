import React from 'react';
import PropTypes from 'prop-types';
import '../../styles/tokens.scss';
import TokenItem from '../TokenItem/index.jsx';

export default function Tokens(token) {
  return (
    <div className="maticTokensList">
      <div className="formHeader">
        <div className="leftSection">
          <div className="headerH5">Balances on Polygon Nightfall</div>
        </div>
      </div>
      <div className="seperator" />
      <div className="tokenListSection">
        <div className="tokenListHeader">
          <div className="headerName">Name</div>
          <div className="headerBalance">Balance</div>
          <div className="headerActions">Actions</div>
        </div>
        {token.tokenList.map((t, index) => (
          <TokenItem {...t} key={index} />
        ))}
      </div>
    </div>
  );
}

Tokens.propTypes = {
  tokenList: PropTypes.array.isRequired,
};
