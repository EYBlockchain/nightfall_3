import React, { useEffect } from 'react';

import './index.css';

function Sidebar({ onChangeTab, tab, users }) {
  const calsses = 'list-group-item list-group-item-action py-2 ripple';

  useEffect(() => {
    console.log('in Sidebar useEffect');
    if (users.length === 2 && tab === 'AddUser') onChangeTab('Deposit');
  });

  return (
    <nav className="collapse d-lg-block sidebar collapse bg-white">
      <div className="position-sticky" style={{ padding: '208px 0 0' }}>
        <div className="list-group list-group-flush mx-4 mt-4">
          {users.length < 2 && (
            <button
              type="button"
              className={tab === 'AddUser' ? `${calsses} active` : calsses}
              onClick={() => onChangeTab('AddUser')}
            >
              <i className="fas fa-tachometer-alt fa-fw me-3"></i>
              <span>Add User</span>
            </button>
          )}
          <button
            type="button"
            className={tab === 'Deposit' ? `${calsses} active` : calsses}
            onClick={() => onChangeTab('Deposit')}
          >
            <i className="fas fa-chart-area fa-fw me-3"></i>
            <span>Deposit</span>
          </button>
          <button
            type="button"
            className={tab === 'Transfer' ? `${calsses} active` : calsses}
            onClick={() => onChangeTab('Transfer')}
          >
            <i className="fas fa-lock fa-fw me-3"></i>
            <span>Transfer</span>
          </button>
          <button
            type="button"
            className={tab === 'Withdraw' ? `${calsses} active` : calsses}
            onClick={() => onChangeTab('Withdraw')}
          >
            <i className="fas fa-lock fa-fw me-3"></i>
            <span>Withdraw</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Sidebar;
