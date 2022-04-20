import React from 'react';
import ReactDOM from 'react-dom';

import './utils/parseConfigs';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'font-awesome/css/font-awesome.min.css';
import 'bootstrap-social/bootstrap-social.css';

import App from './views/app.view.jsx';
import mainStyle from './main.scss';
import reportWebVitals from './reportWebVitals';
import init from './web-worker/index.js';
import './configurePageRefresh';

class DemoAppSolution extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const { shadowRoot } = this;
    const container = document.createElement('div');
    shadowRoot.appendChild(container);
    ReactDOM.render(<App />, shadowRoot);

    const styleTag = document.createElement('style');
    styleTag.innerHTML = mainStyle;
    shadowRoot.appendChild(styleTag);
  }
}

window.customElements.define('nightfall-app', DemoAppSolution);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// init from web-worker runs worker to download/fetch circuits files
// frrom AWS S3 bucket and store in indexedDB
init();
