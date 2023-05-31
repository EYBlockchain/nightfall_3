import React from 'react';

import './index.css';

function Loader() {
  return (
    <div className="collapse d-lg-block loader collapse bg-light p-2 bg-opacity-75">
      <div
        className="spinner-grow text-primary p-4"
        role="status"
        style={{ position: 'absolute', top: '50%', left: '50%' }}
      ></div>
    </div>
  );
}

export default Loader;
