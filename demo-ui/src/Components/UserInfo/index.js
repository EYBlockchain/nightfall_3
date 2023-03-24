import React from 'react';
import './index.css';

function UserInfo({ users, updateBalances }) {
  return (
    <nav className="collapse d-lg-block userInfo collapse bg-white">
      {users[0] && (
        <div className="text-center" style={{ padding: '108px 0 0' }}>
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={e => {
              e.preventDefault();
              if (!users[0]) return;
              updateBalances();
            }}
          >
            Fetch Balances
          </button>
        </div>
      )}
      <div className="position-sticky" style={{ padding: '54px 0 0' }}>
        {users[0] ? (
          <div style={{ textAlign: 'center' }}>
            <table className="table table-striped" style={{ marginTop: '10px' }}>
              <tbody>
                <tr>
                  <td>Name</td>
                  <th>
                    <span>{users[0].name}</span>
                    {users[0].isCurrent && (
                      <span
                        style={{
                          color: 'green',
                          marginLeft: '4px',
                          cursor: 'pointer',
                        }}
                        title="connected"
                      >
                        <i className="bi bi-plugin"></i>
                      </span>
                    )}
                  </th>
                </tr>
                <tr>
                  <td>L1-Balance</td>
                  <td style={{ fontSize: 'small' }}>{users[0].l1Balance}</td>
                </tr>
                <tr>
                  <td>L2-Balance</td>
                  <td>{users[0].l2Balance}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
        {users[1] ? (
          <div style={{ marginTop: '100px', textAlign: 'center' }}>
            <table className="table table-striped" style={{ marginTop: '10px' }}>
              <tbody>
                <tr>
                  <td>Name</td>
                  <th>
                    <span>{users[1].name}</span>
                    {users[1].isCurrent && (
                      <span
                        style={{
                          color: 'green',
                          marginLeft: '4px',
                          cursor: 'pointer',
                        }}
                        title="connected"
                      >
                        <i className="bi bi-plugin"></i>
                      </span>
                    )}
                  </th>
                </tr>
                <tr>
                  <td>L1-Balance</td>
                  <td style={{ fontSize: 'small' }}>{users[1].l1Balance}</td>
                </tr>
                <tr>
                  <td>L2-Balance</td>
                  <td>{users[1].l2Balance}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

export default UserInfo;
