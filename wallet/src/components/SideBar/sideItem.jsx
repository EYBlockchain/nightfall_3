import React from 'react';
import PropTypes from 'prop-types';
import { Link, useHistory } from 'react-router-dom';

import './sideItem.scss';

export default function SideItem({ text, link, Icon, SideState }) {
  const history = useHistory();
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
      <div className={history.location.pathname !== link ? 'itemInactive' : 'itemActive'}>
        {/* <Icon size={24} /> */}
        <img alt="icon" src={history.location.pathname !== link ? Icon[1] : Icon[0]} />
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
