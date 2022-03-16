/* eslint-disable @babel/no-unused-expressions */
import React from 'react';
import ReactDOM from 'react-dom';

import './utils/parseConfigs';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.min.css';
import 'bootstrap-social/bootstrap-social.css';
import './index.css';
import './views/app.style.css';

import App from './views/app.view.jsx';
import reportWebVitals from './reportWebVitals';
import init from './web-worker';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root'),
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// init from web-worker runs worker to download/fetch circuits files
// frrom AWS S3 bucket and store in indexedDB
init();
