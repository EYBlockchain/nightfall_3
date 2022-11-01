import React from 'react';
import ReactDOM from 'react-dom';

import './utils/parseConfigs'; // also sets global.constants

import App from './views/App';
import mainStyle from './main.scss';
import reportWebVitals from './reportWebVitals';
import init from './web-worker/index.js';

const styleTag = document.createElement('style');
styleTag.innerHTML = mainStyle;
document.head.appendChild(styleTag);

ReactDOM.render(<App />, document.getElementById('root'));

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// init from web-worker runs worker to download/fetch circuits files
// frrom AWS S3 bucket and store in indexedDB
init();
