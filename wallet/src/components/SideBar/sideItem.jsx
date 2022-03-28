import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

import './sideItem.scss';

export default function SideItem({ text, link, Icon, SideState }) {  
  return (
    <Link
      to={{
        pathname: link,
        tokenState: {
          tokenAddress: SideState,
          initialTxType: 'deposit',
        },
      }}
    >
      <div className={window.location.pathname !== link ? 'itemInactive' : 'itemActive'}>
        {/* <Icon size={24} /> */}
        <img alt="icon" src={window.location.pathname !== link ? Icon[1] : Icon[0]} />
        <div className="itemText" id={text}>
          {text}
        </div>
      </div>
    </Link>
  );
}

SideItem.propTypes = {
  text: PropTypes.string.isRequired,
  link: PropTypes.string.isRequired,
  Icon: PropTypes.array.isRequired,
  SideState: PropTypes.string,
};
