// ignore unused exports
import React from 'react';
import config from 'config'; // eslint-disable-line  import/no-extraneous-dependencies
import './index.css';

function AddUser({ addNewUser }) {
  const [userName, setUserName] = React.useState('');
  const [userMnemonic, setUserMnemonic] = React.useState('');
  const [mnemonics, setUserMnemonics] = React.useState([
    ...new Set(Object.entries(config.TEST_OPTIONS.mnemonics).map(a => a[1])),
  ]);

  function submitNewUser(e) {
    e.preventDefault();
    addNewUser(userName, userMnemonic);
    setUserName('');
    setUserMnemonic('');

    // remove used mnemonic from array
    mnemonics.splice(mnemonics.indexOf(userMnemonic), 1);
    setUserMnemonics(mnemonics);
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
          <div className="form-group form-custom-field-d">
            <input
              type="text"
              className="form-control"
              placeholder="User Mnemonic"
              value={userMnemonic}
              style={{ width: '74%', display: 'inline-block', marginRight: '10px' }}
              onChange={e => setUserMnemonic(e.target.value)}
            />
            or
            <select
              className="form-select"
              aria-label="Default select example"
              value={userMnemonic}
              style={{ width: '6%', display: 'inline-block', marginLeft: '10px' }}
              onChange={e => setUserMnemonic(e.target.value)}
            >
              <option value=""> </option>
              {mnemonics.map(value => (
                <option key={Math.random()} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <label>
              <small>
                Enter or copy paste mnemonic in input box, or select from options (these options are
                from config and are applicable, while testing with local ganache)
              </small>
            </label>
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
