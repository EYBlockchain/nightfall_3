import verifyIfValueIsGreaterThen from "../utils/verifyIfValueIsGreaterThen";

test('verify 2 is greater than 1', () => {
  expect(verifyIfValueIsGreaterThen(2, 1)).toBeTruthy();
});

test('verify 1 is not greater than 1', () => {
  expect(verifyIfValueIsGreaterThen(1, 1)).toBeFalsy();
});

test('verify 1 is not greater than 2', () => {
  expect(verifyIfValueIsGreaterThen(1, 2)).toBeFalsy();
});

export {};