/* eslint-disable react/prefer-stateless-function */
/* eslint-disable no-useless-constructor */
/* eslint-disable no-unused-vars */

// eslint-disable-next-line no-unused-vars
// class TestElement extends HTMLElement {
//   constructor() {
//     super();
//     this.setAttribute('name', 'ashton'); // setting an attribute
//   }

//   connectedCallback() {
//     this.innerHTML = `<div><p>Hello ${this.getAttribute('name')}!</p><p>Nice to meet you</p></div>`;
//   }
// }

import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebcomponent from 'react-to-webcomponent';

class Teste extends React.Component {
  constructor() {
    super();
  }

  render() {
    return <h1>TESTE TESTE</h1>;
  }
}

const HtmlComp = reactToWebcomponent(Teste, React, ReactDOM);
// register the custom element
customElements.define('test1-element', HtmlComp);

const webGreeting = document.createElement('test1-element');
document.getElementById('root').append(webGreeting);

// ReactDOM.render(<Teste />, document.getElementById('root'));
