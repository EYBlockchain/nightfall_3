import styled, { keyframes } from 'styled-components';

export const HeaderTitle = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 10px;
  font-weight: bold;
`;

export const MyBody = styled.div`
  flex-direction: column;
  text-align: center;
  padding: 10px;
`;

export const SendModalStyle = styled.div`
  input {
    width: 100%;
    height: 50px;
    border-radius: 10px;
    padding: 15px;
  }

  p {
    text-align: start;
    font-size: small;
    color: #b0b4bb;
    margin-top: 10px;
  }
`;

export const InputSearchTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  width: 100%;
  padding: 24px 12px;
  /* Header/H2 */

  font-style: normal;
  font-weight: 800;
  font-size: 26px;

  /* identical to box height, or 122% */

  letter-spacing: -0.01em;

  /* light/gray-900 */

  color: #0a0b0d;

  span {
    color: #7b3fe4;
  }

  svg {
    &:hover {
      cursor: pointer;
      color: 555;
    }
  }
`;

export const InputWrapper = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
  padding: 32px;

  input {
    border: 0px;
    margin-left: 10px;

    &:placeholder {
      font-family: Manrope;
      font-style: normal;
      font-weight: 500;
      font-size: 14px;
      line-height: 24px;
      /* identical to box height, or 171% */

      display: flex;
      align-items: flex-end;

      color: #000000;

      opacity: 0.5;
    }

    &:focus {
      outline: none;
    }
  }
`;

export const TokensList = styled.ul`
  padding-right: 24px;
`;

export const TokensLine = styled.li`
  width: 100%;

  list-style: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 80px;
  border-bottom: 1px solid #f3f4f7;
  padding: 10px;

  &:hover {
    cursor: pointer;
    background: #ddd;
  }
`;

export const TokensLineDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center !important;
`;

export const TokensLineDivImg = styled.img`
  margin-right: 12px;

  width: 40px;
  height: 40px;
`;

export const SendModalBalance = styled.div`
  margin-top: 50px;
  display: flex;
  flex-direction: row !important;
  align-items: center;
  justify-content: space-between;
  border: solid 1px #b0b4bb;
  height: 60px;
  border-radius: 10px;
  padding: 5px;
  width: 100%;
`;

export const SendModalBalanceLeft = styled.div`
  width: 40%;
  display: flex;
  align-items: center;
  justify-content: space-around;
  align-content: center;
`;

export const InputBalance = styled.input`
  border: none;
  width: 50%;
  padding: 0 10px;

  ::placeholder {
    color: $light-gray-900;
  }

  &:focus {
    outline: none;
  }
`;

export const InputAddress = styled.input`
  border: solid 1px #b0b4bb;
  height: 20px;
  padding: 20px;
  ::placeholder {
    color: $light-gray-900;
  }

  &:focus {
    outline: #b0b4bb;
  }
`;

export const MaxButton = styled.div`
  color: #7b3fe4;
  font-weight: 600;
  font-size: small;
  padding: 5px;

  &:hover {
    cursor: pointer;
    background-color: $light-gray-200;
    border-radius: 5px;
  }
`;

export const SendModalBalanceRight = styled.div`
  width: 40%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  align-content: flex-end;
  background-color: #eee;
  height: 50px;
  border-radius: 10px;
  padding: 10px;

  &:hover {
    cursor: pointer;
    background-color: #ddd;
  }
`;

export const BalanceText = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

export const BalanceTextRight = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  p {
    &:first-child {
      margin-right: 5px;
    }
  }
`;

export const SendModalFooter = styled.div`
  display: flex;
  flex-direction: row;

  img {
    width: 20px;
  }

  padding-top: 90px;

  p {
    margin-left: 5px;
    font-size: medium;
  }
`;

export const ContinueTransferButton = styled.div`
  margin-top: 12px;
  border-radius: 12px;
  align-self: flex-end;
  width: 100%;
  background-color: #7b3fe4;
  color: #fff;
  padding: 15px;
  margin-bottom: 12px;

  &:hover {
    cursor: pointer;
  }
`;

export const ProcessImages = styled.div`
  img {
    width: 340px;
  }
`;

export const Divider = styled.div`
  margin-top: 30px;
  border-bottom: solid 1px #ddd;
`;

export const SpineerBox = styled.div`
  display: flex;
  justify-content: center;
  align-content: center;
  align-items: center;
  margin-top: 20px;
`;

export const SpinnerBoard = styled.div`
  display: flex;
  justify-content: center;
  align-content: center;
  align-items: center;
  --size: 150px;
  --border: 2px;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;

  border: var(--border) solid #eee;
`;
const spin = keyframes`
  100% {
    transform: rotate(360deg);
  }
`;

export const Spinner = styled.div`
  --size: 100px;
  --border: 4px;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  position: relative;
  border: var(--border) solid #7b3fe4;
  border-right: var(--border) solid #eae0fb;
  animation: ${spin} 1s linear infinite;
`;
