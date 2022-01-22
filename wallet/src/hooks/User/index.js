import React from 'react';

export const reducer = (state, action) => {
  switch (action.type) {
    case 'toggle_button':
      return {
        ...state,
        active: !state.active,
      };
    default:
      return state;
  }
};

export const initialState = {
  active: false,
  mnemonic: 'dummy',
  nf: {},
};

export const UserContext = React.createContext({
  state: initialState,
});

// eslint-disable-next-line react/prop-types
export const UserProvider = ({ children }) => {
  // const [state, dispatch] = React.useReducer(reducer, initialState);
  const [state, setState] = React.useState(initialState);
  return <UserContext.Provider value={[state, setState]}>{children}</UserContext.Provider>;
};
