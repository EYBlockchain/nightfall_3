import React from 'react';

import './index.css';

function Transfer({ users, updateLoader, erc20Address }) {
  const [transferValue, setTransferValue] = React.useState();
  const [receipent, setReceipent] = React.useState('');
  function doTransfer(e) {
    e.preventDefault();

    if (!users[0]) return;
    if (receipent === '') return;

    updateLoader(true);
    const [{ nf3Object }] = users.filter(user => user.isCurrent);

    nf3Object
      .transfer(
        false,
        erc20Address,
        'ERC20',
        Number(transferValue),
        '0x00',
        users[Number(receipent)].nf3Object.zkpKeys.compressedZkpPublicKey,
      )
      .then(() => updateLoader(false))
      .catch(err => {
        console.log(err);
        updateLoader(false);
      });
    setTransferValue('');
    setReceipent('');
  }

  return (
    <main style={{ marginTop: '158px' }}>
      <div className="container pt-4">
        <form className="form">
          <div className="form-group form-custom-field">
            <input
              type="number"
              className="form-control"
              placeholder="Tranfer Value"
              value={transferValue}
              onChange={e => setTransferValue(e.target.value)}
            />
          </div>
          <div className="form-group form-custom-field">
            <select
              className="form-select"
              aria-label="Default select example"
              value={receipent}
              onChange={e => setReceipent(e.target.value)}
            >
              <option value="">Select Receipent</option>
              <option value="0">{users[0] && users[0].name}</option>
              <option value="1">{users[1] && users[1].name}</option>
            </select>
          </div>
          <div className="form-group form-custom-field">
            <button type="button" className="btn btn-primary" onClick={doTransfer}>
              Transfer
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default Transfer;
