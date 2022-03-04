/* eslint-disable react/jsx-no-undef */
/* eslint-disable react/jsx-pascal-case */
import React, { useContext } from 'react';
import { BsArrowRight } from 'react-icons/bs';
import styles from '../../styles/bridge.module.scss';
import pgIcon from '../../static/img/bridgepage/pg_coin4x2.png';
import ethIcon from '../../static/img/bridgepage/eth_coin4x2.png';
import Header from '../../components/Header/header.jsx';
import SideBar from '../../components/SideBar/index.jsx';
// eslint-disable-next-line import/no-unresolved
import { UserContext } from '../../hooks/User/index.jsx';
import BridgeComponent from '../../components/BridgeComponent/index.jsx';
import './styles.scss';

const Bridge = () => {
  const [state] = useContext(UserContext);

  return (
    // containerFluid

    <div>
      <Header />
      <div className={styles.bridgeComponent}>
        <div className={styles.bridgeComponent__left}>
          <SideBar />
        </div>
        <div className={styles.bridgeComponent__right}>
          <div className={styles.blueBack}>
            {/* <WarningBanner className="warning-banner" /> */}

            <div className={styles.pagePartition}>
              <div>
                <BridgeComponent value={state} />
              </div>
              <div className="info_wrapper">
                <div className="info_painel_title">Nightfall Bridge</div>
                <div className="info_painel_description">
                  The safe, fast and most secure way to bring cross-chain assets to Polygon chain.
                </div>
                <div className="items">
                  <div className="each_item_wrapper">
                    <a
                      id="youtube-video-tutorial"
                      className="items_text"
                      href="YOUTUBE_VIDEO_TUTORIAL"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      How it works?
                    </a>
                    <div>
                      <BsArrowRight />
                    </div>
                  </div>
                  <div className="each_item_wrapper">
                    <a
                      id="faq-docs"
                      className="items_text"
                      href="FAQ_DOCS_LINK"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      FAQ
                    </a>
                    <div>
                      <BsArrowRight />
                    </div>
                  </div>
                  <div className="each_item_wrapper">
                    <a
                      id="user-guide"
                      className="items_text"
                      href="USER_GUIDE_DOCS_LINK"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      User guide
                    </a>
                    <div>
                      <BsArrowRight />
                    </div>
                  </div>
                </div>
                <div className="img1">
                  <img src={ethIcon} alt="" />
                </div>
                <div className="img2">
                  <img src={pgIcon} alt="" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bridge;
