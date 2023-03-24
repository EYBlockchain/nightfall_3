import React from 'react';

import './index.css';

function Withdraw({ users, updateLoader, erc20Address }) {
  const [withdrawValue, setWithdrawValue] = React.useState();

  function doWithdraw(e) {
    e.preventDefault();
    if (!users[0]) return;

    updateLoader(true);
    const [{ nf3Object }] = users.filter(user => user.isCurrent);
    nf3Object
      .withdraw(
        false,
        erc20Address,
        'ERC20',
        Number(withdrawValue),
        '0x00',
        nf3Object.ethereumAddress,
      )
      .then(() => updateLoader(false));
    setWithdrawValue('');
  }

  return (
    <main style={{ marginTop: '158px' }}>
      <div className="container pt-4">
        <form className="form">
          <div className="form-group form-custom-field">
            <input
              type="number"
              className="form-control"
              placeholder="Withdraw Value"
              value={withdrawValue}
              onChange={e => setWithdrawValue(e.target.value)}
            />
          </div>
          <div className="form-group form-custom-field">
            <button type="button" className="btn btn-primary" onClick={doWithdraw}>
              Withdraw
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default Withdraw;
