// ignore unused exports
import Nf3 from '@cli-library/nf3.mjs'; // eslint-disable-line import/no-unresolved
import React, { useState } from 'react';

import Loader from './Components/Loader';
import Configure from './Components/Configure';
import Footer from './Components/Footer';
import Sidebar from './Components/Sidebar';
import UserInfo from './Components/UserInfo';
import Navbar from './Components/Navbar';
import AddUser from './Components/AddUser';
import Deposit from './Components/Deposit';
import Transfer from './Components/Transfer';
import Withdraw from './Components/Withdraw';

import { getUserBalances, getMetamaskEOA, listenMetmaskEOAChange } from './utils';

import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

function App() {
  const [users, setUsers] = useState([]);
  const [isLoading, setLoader] = useState(false);
  const [tab, setTab] = useState('AddUser');
  const [erc20Address, setERC20Address] = useState(); // 0x4315287906f3fcf2345ad1bfe0f682457b041fa7

  async function addNewUser(name, mnemonic) {
    const user = new Nf3('');
    await user.init(mnemonic);
    const { l2Balance, l1Balance } = await getUserBalances(user, erc20Address);
    const metamaskEOA = (await getMetamaskEOA())[0];
    setUsers(users => [
      ...users,
      {
        name,
        l2Balance,
        l1Balance,
        nf3Object: user,
        isCurrent: user.ethereumAddress.toLowerCase() === metamaskEOA,
      },
    ]);
  }

  async function changeCurrentUser() {
    const metamaskEOA = (await getMetamaskEOA())[0];
    setUsers(users =>
      users.map(user => {
        return { ...user, isCurrent: user.nf3Object.ethereumAddress.toLowerCase() === metamaskEOA };
      }),
    );
  }
  listenMetmaskEOAChange(changeCurrentUser);

  async function updateBalances(onlyL2 = false) {
    const user1 = await getUserBalances(users[0].nf3Object, erc20Address);
    const user2 = users[1] && (await getUserBalances(users[1].nf3Object, erc20Address));

    if (
      user1.l2Balance !== users[0].l2Balance ||
      (!onlyL2 && user1.l1Balance !== users[0].l1Balance) ||
      (user2 && user2.l2Balance !== users[1].l2Balance) ||
      (!onlyL2 && user2 && user2.l1Balance !== users[1].l1Balance)
    ) {
      if (user2) {
        setUsers(users => [{ ...users[0], ...user1 }, users[1] && { ...users[1], ...user2 }]);
      } else {
        setUsers(users => [{ ...users[0], ...user1 }]);
      }
      return true;
    }
    return false;
  }

  return (
    <div>
      {isLoading && <Loader />}
      {!erc20Address && <Configure setERC20Address={setERC20Address} />}
      <Sidebar tab={tab} onChangeTab={setTab} users={users} />
      <Navbar users={users} updateBalances={updateBalances} updateLoader={setLoader} />
      <UserInfo users={users} updateBalances={updateBalances} />
      {tab === 'AddUser' && <AddUser addNewUser={addNewUser} />}
      {tab === 'Deposit' && (
        <Deposit users={users} updateLoader={setLoader} erc20Address={erc20Address} />
      )}
      {tab === 'Transfer' && (
        <Transfer users={users} updateLoader={setLoader} erc20Address={erc20Address} />
      )}
      {tab === 'Withdraw' && (
        <Withdraw users={users} updateLoader={setLoader} erc20Address={erc20Address} />
      )}
      <Footer />
    </div>
  );
}

export default App;
