/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/prop-types */
/* eslint-disable react/prefer-stateless-function */
import React from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';

class Greeting extends React.Component {
  render() {
    return <h1>Hello, {this.props.name}</h1>;
  }
}

const WebGreeting = reactToWebComponent(Greeting, React, ReactDOM);

window.customElements.define('web-greeting', WebGreeting);

document.getElementById('root').innerHTML = '<web-greeting></web-greeting>';
