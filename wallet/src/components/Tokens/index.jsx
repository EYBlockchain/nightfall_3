import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import '../../styles/tokens.scss';
import { IoIosArrowDown } from 'react-icons/io';
import TokenItem from '../TokenItem/index.jsx';
import { UserContext } from '../../hooks/User/index.jsx';
import polygonNightfall from '../../assets/svg/polygon-nightfall.svg';

export default function Tokens(token) {
  const [state] = useContext(UserContext);

  console.log(state);

  return (
    <div className="maticTokensList">
      <div className="formHeader">
        <div className="leftSection">
          <div className="headerH5">Balances on Polygon Nightfall</div>
          <div className="accountBox">
            <img src={polygonNightfall} />
            {state.compressedPkd && (
              <div className="accountAddress">
                {`${state.compressedPkd.slice(0, 6)}...${state.compressedPkd.slice(-6)}`}
              </div>
            )}
            <span>
              <IoIosArrowDown />
            </span>
          </div>
          {/* <div className="headerH5 light-gray-500">{`Nightfall address: ${state.compressedPkd.slice(0, 6)}...${state.compressedPkd.slice(-6)}`}</div> */}
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
