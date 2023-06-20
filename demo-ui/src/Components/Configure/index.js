// ignore unused exports
import React from 'react';
import './index.css';

import { swithNetwork, addNetwork } from '../../utils';

function Configure({ setERC20Address }) {
  const [erc20Address, setLocalERC20Address] = React.useState('');
  const [chainId, setChainId] = React.useState(
    window.ethereum.networkVersion ? `${window.ethereum.networkVersion}` : '1337',
  );
  async function doConfigure(e) {
    if (!erc20Address) console.log('Provided ERC20 address is not valid');
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
          <form className="form bg-opacity-0 bg-light" onSubmit={doConfigure}>
            <div className="form-group form-custom-field">
              <input
                type="text"
                className="form-control"
                placeholder="ERC 20 Contract Address"
                onChange={e => setLocalERC20Address(e.target.value)}
                value={erc20Address}
                style={{ marginBottom: '5px' }}
              />
              <input
                className="form-check-input"
                type="checkbox"
                onChange={e => {
                  if (erc20Address) {
                    return setLocalERC20Address('');
                  }
                  return setLocalERC20Address(e.target.value);
                }}
                value="0x4315287906f3fcf2345ad1bfe0f682457b041fa7"
                checked={erc20Address === '0x4315287906f3fcf2345ad1bfe0f682457b041fa7'}
                style={{ marginRight: '10px' }}
              />
              <label>
                <small>Use contract address</small>
              </label>
              <label>
                <small>
                  0x4315287906f3fcf2345ad1bfe0f682457b041fa7, if testing with local ganache from
                  nightfall start script.
                </small>
              </label>
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
                <label className="form-check-label">Polygon</label>
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
                <label className="form-check-label">Mumbai Testnet Polygon</label>
              </div>
            </div>
            <div className="form-group form-custom-field">
              <label>
                To connect to Localhost chainId 1337, please do the switch manually in metamask
                (please read readme.md for better understanding).
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
