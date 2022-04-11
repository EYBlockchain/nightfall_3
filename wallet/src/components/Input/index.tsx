import React, { InputHTMLAttributes, useCallback } from 'react';

import { cep, currency, cpf } from './masks';

import './styles.scss';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mask: 'cep' | 'currency' | 'cpf';
  prefix?: string;
}

const Input: React.FC<InputProps> = ({ mask, ...props }) => {
  const handleKeyUp = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => {
      if (mask === 'cep') {
        cep(e);
      }
      if (mask === 'currency') {
        currency(e);
      }
      if (mask === 'cpf') {
        cpf(e);
      }
    },
    [mask],
  );

  return (
    <div className="input-group prefix">
      <input className="amount_value" {...props} onKeyUp={handleKeyUp} />
    </div>
  );
};

export default Input;
