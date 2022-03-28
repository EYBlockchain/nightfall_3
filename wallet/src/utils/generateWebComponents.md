import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebcomponent from 'react-to-webcomponent';
import App from '../views/app.view.jsx';
import mainStyle from '../main.module.scss';

// const generateWebComponents = () => {
//   // if (customElements.get('nightfall-app') === undefined) {
//   //   const AppEl = reactToWebcomponent(App, React, ReactDOM);
//   //   customElements.define('nightfall-app', AppEl);
//   // }
// };
// // ignore unused exports
// export default generateWebComponents;

class DemoAppSolution extends HTMLElement {

  constructor() {
      console.log("MAINSTYLE: ",mainStyle);
      super();
      this.attachShadow({ mode: 'open' });
      const { shadowRoot } = this;
      // const container = document.createElement('div');
      // shadowRoot.appendChild(container);
      ReactDOM.render(<App />, shadowRoot);

      const styleTag = document.createElement('style');
      styleTag.innerHTML = mainStyle;
      shadowRoot.appendChild(styleTag);
  }
}

window.customElements.define('nightfall-app', DemoAppSolution);