import React from 'react';

function Navbar({ users, updateBalances, updateLoader }) {
  let interval;

  function makeBlockNow(e) {
    e.preventDefault();
    if (!users[0]) return;
    updateLoader(true);
    users[0].nf3Object.makeBlockNow();

    clearInterval(interval);

    interval = setInterval(async () => {
      const isUpdated = await updateBalances(true);
      if (isUpdated) {
        clearInterval(interval);
        updateLoader(false);
      }
    }, 5000);
  }

  return (
    <nav className="footer text-center text-lg-start bg-white text-muted fixed-top row">
      <div className="text-center col-10"></div>
      <div className="text-center col-2">
        <button type="button" className="btn btn-success" onClick={makeBlockNow}>
          Make BLock Now
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
