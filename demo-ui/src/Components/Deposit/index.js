import React from 'react';

import './index.css';

function Deposit({ users, updateLoader, erc20Address }) {
  const [depositValue, setDepositValue] = React.useState();

  function doDeposit(e) {
    e.preventDefault();
    if (!users[0]) return;
    updateLoader(true);
    const [{ nf3Object }] = users.filter(user => user.isCurrent);
    nf3Object
      .deposit(erc20Address, 'ERC20', Number(depositValue), '0x00')
      .then(() => updateLoader(false));
    setDepositValue('');
  }

  return (
    <main style={{ marginTop: '158px' }}>
      <div className="container pt-4">
        <form className="form">
          <div className="form-group form-custom-field">
            <input
              type="number"
              className="form-control"
              placeholder="Deposit Value"
              value={depositValue}
              onChange={e => setDepositValue(e.target.value)}
            />
          </div>
          <div className="form-group form-custom-field">
            <button type="button" className="btn btn-primary" onClick={doDeposit}>
              Deposit
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default Deposit;
