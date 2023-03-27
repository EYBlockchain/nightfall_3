// ignore unused exports
import React from 'react';
import './index.css';

import { swithNetwork, addNetwork } from '../../utils';

function Configure({ setERC20Address }) {
  let erc20Address;
  const [chainId, setChainId] = React.useState(
    window.ethereum.networkVersion ? `${window.ethereum.networkVersion}` : '1337',
  );
  async function doConfigure(e) {
    e.preventDefault();
    if (window.ethereum.networkVersion !== Number(chainId)) {
      try {
        await swithNetwork(chainId);
      } catch (err) {
        if (err.code === 4902) {
          await addNetwork(chainId);
        }
      }
    }
    setERC20Address(erc20Address);
  }

  return (
    <div className="collapse d-lg-block configure collapse bg-light p-2 bg-opacity-75">
      <main style={{ marginTop: '158px' }}>
        <div className="container pt-4">
          <form className="form bg-opacity-0 bg-light">
            <div className="form-group form-custom-field">
              <input
                type="text"
                className="form-control"
                placeholder="ERC 20 Contract Address"
                onChange={function (e) {
                  erc20Address = e.target.value;
                }}
              />
            </div>
            <div
              className="form-group form-custom-field"
              onChange={e => setChainId(e.target.value)}
            >
              <label className="form-label"> Connect To: </label>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="metamaskNetwork"
                  onChange={() => {}}
                  value="137"
                  checked={chainId === '137'}
                />
                <label className="form-check-label">Ploygon</label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="metamaskNetwork"
                  onChange={() => {}}
                  value="80001"
                  checked={chainId === '80001'}
                />
                <label className="form-check-label">Mumbai Testnet Ploygon</label>
              </div>
            </div>
            <div className="form-group form-custom-field">
              <label>
                To connect to Localhost chainId 1337, please do the switch/add manually in metamask
                as auto-code switch will not work, because for chainId 1337 metamask code API will
                try to reach to rpcURL http://localhost:8545 but our localhost is configured to run
                on rpcURL http://localhost:8546 instead.
              </label>
            </div>
            <div className="form-group form-custom-field">
              <button type="button" className="btn btn-primary" onClick={doConfigure}>
                Configure
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default Configure;
