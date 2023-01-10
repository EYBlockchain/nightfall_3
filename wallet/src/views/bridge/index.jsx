import React, { useContext } from 'react';
import { useMediaQuery } from 'react-responsive';
import SideBar from '@Components/SideBar/index.jsx';
import BridgeComponent from '@Components/BridgeComponent/index.jsx';
import Header from '@Components/Header/header.jsx';
import pgIcon from '../../static/img/bridgepage/pg_coin4x2.png';
import ethIcon from '../../static/img/bridgepage/eth_coin4x2.png';
import { UserContext } from '../../hooks/User/index.jsx';
import './styles.scss';

const Bridge = () => {
  const [state] = useContext(UserContext);
  const isTabletOrMobile = useMediaQuery({ query: '(min-width: 1000px)' });

  return (
    // containerFluid
    <div>
      {process.env.REACT_APP_MODE === 'local' ? <Header /> : <></>}
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
                <BridgeComponent value={state} />
              </div>
              <div className="info_wrapper">
                <div className="info_painel_title">Nightfall Bridge</div>
                <div className="info_painel_description">
                  The safe, fast and most secure way to bring cross-chain assets to Nightfall.
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

export default Bridge;
