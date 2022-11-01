import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebcomponent from 'react-to-webcomponent';
import App from '../views/App';

const generateWebComponents = () => {
  if (customElements.get('nightfall-app') === undefined) {
    const AppEl = reactToWebcomponent(App, React, ReactDOM);
    customElements.define('nightfall-app', AppEl);
  }
};
// ignore unused exports
export default generateWebComponents;
