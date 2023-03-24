// ignore unused exports
import React from 'react';

import './index.css';

function AddUser({ addNewUser }) {
  const [userName, setUserName] = React.useState('');
  const [userMnemonic, setUserMnemonic] = React.useState('');

  function submitNewUser(e) {
    e.preventDefault();
    addNewUser(userName, userMnemonic);
    setUserName('');
    setUserMnemonic('');
  }

  return (
    <main style={{ marginTop: '158px' }}>
      <div className="container pt-4">
        <form className="form">
          <div className="form-group form-custom-field">
            <input
              type="text"
              className="form-control"
              placeholder="User Name"
              value={userName}
              onChange={e => setUserName(e.target.value)}
            />
          </div>
          <div className="form-group form-custom-field">
            <input
              type="text"
              className="form-control"
              placeholder="User Mnemonic"
              value={userMnemonic}
              onChange={e => setUserMnemonic(e.target.value)}
            />
          </div>
          <div className="form-group form-custom-field">
            <button type="button" className="btn btn-primary" onClick={submitNewUser}>
              Add User
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default AddUser;
