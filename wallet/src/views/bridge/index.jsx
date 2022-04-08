/* eslint-disable react/jsx-no-undef */
/* eslint-disable react/jsx-pascal-case */
import React, { useContext } from 'react';
import PropTypes from 'prop-types';
import styles from '../../styles/bridge.module.scss';
import bridgeInfoImage from '../../assets/img/bridge-info.png';
import { useMediaQuery } from 'react-responsive';
import pgIcon from '../../static/img/bridgepage/pg_coin4x2.png';
import ethIcon from '../../static/img/bridgepage/eth_coin4x2.png';
import Header from '../../components/Header/header.jsx';
import SideBar from '../../components/SideBar/index.jsx';
// eslint-disable-next-line import/no-unresolved
import { UserContext } from '../../hooks/User/index.jsx';
import BridgeComponent from '../../components/BridgeComponent/index.jsx';
import './styles.scss';

const Bridge = ({ changeChain }) => {
  const [state] = useContext(UserContext);
  const isTabletOrMobile = useMediaQuery({ query: '(min-width: 1000px)' });

  return (
    // containerFluid
    <div>
      <Header />
      <div className="bridgeComponent">
        {isTabletOrMobile && (
          <div className="bridgeComponent__left">
            <SideBar />
          </div>
        )}
        <div className="bridgeComponent__right">
          <div className="blue_back">
            {/* <WarningBanner className="warning-banner" /> */}

            <div className="page_partition">
              <div>
                <BridgeComponent value={state} changeChain={changeChain} />
              </div>
              <div className="info_wrapper">
                <div className="info_painel_title">Nightfall Bridge</div>
                <div className="info_painel_description">
                  The safe, fast and most secure way to bring cross-chain assets to Polygon chain.
                </div>
                {isTabletOrMobile && (
                  <>
                    <div className="img1">
                      <img src={ethIcon} alt="" />
                    </div>
                    <div className="img2">
                      <img src={pgIcon} alt="" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

Bridge.propTypes = {
  changeChain: PropTypes.func.isRequired,
};

export default Bridge;
