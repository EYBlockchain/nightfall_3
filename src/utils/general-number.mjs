/* eslint-disable no-control-regex, no-underscore-dangle, no-use-before-define, max-classes-per-file, no-restricted-syntax */

import {
  resizeHex,
  isHex,
  ensure0x,
  strip0x,
  hexToBinArray,
  hexToBin,
  hexToBytes,
  hexToDec,
  hexToField,
  hexToAscii,
  hexToUtf8,
  hexToLimbs,
  hexToDecLimbs,
  binToHex,
  decToHex,
  utf8ToHex,
  asciiToHex,
} from './conversions.mjs';

/**
 * @dev:
 *  - Instead of relying on inference, users will occasionally need to explicitly pass a 'type' parameter to the `new GeneralNumber()` constructor.
 *  - 'hex' values are only _inferred_ as 'hex' if they have an 0x prefix (otherwise they could be inferred as ascii or integer).
 *  - 'binary' values CANNOT be inferred as 'binary'; they'd be confused with 'integer'. The 'binary' type MUST be explicitly passed to the `new GeneralNumber()` constructor in order to generalise a binary number. You CANNOT use the `generalise()` function to generalise a 'binary' value; it would incorrectly be inferred as an integer.
 *  - 'limbs' values CAN be inferred as 'limbs', BUT ONLY IF passed _directly_ to the `new GeneralNumber()` constructor. You CANNOT use the `generalise()` function to generalise a 'limbs' value; it would be incorrectly interpreted as a standard array of values (resulting in incorrect conversion to other types).
 *
 */
const inferType = value => {
  if (value === undefined) throw new Error('Input value was undefined');
  if (value === '') throw new Error('Input was empty');
  if (typeof Object(value).valueOf() === 'bigint') return 'bigint';
  if (Array.isArray(value)) {
    // ensure all elements of the array are of the same type:
    if (value.map(inferType).every((val, i, arr) => val === arr[0])) return 'limbs'; // infer arrays whcich contain elements of the same type as 'limbs'
  }
  if (typeof thing === 'object') {
    throw new Error(
      `Cannot construct a new GeneralNumber from an object (unless it's a 'BigInt' or 'limbs' array). Received ${value}. Try using the 'generalise()' function on this object instead.`,
    );
  }
  if (typeof value === 'boolean') return 'boolean';
  if (isHex(value) === true) return 'hex';
  if (/^[0-9]+$/.test(value)) return 'integer'; // same effect as 'decimal' or 'number'
  if (/^[\x00-\x7F]*$/.test(value) === true) return 'ascii';
  return 'utf8';
};

/**
 * Whilst the 'inferType' function can infer a value's 'type' for many types of input value, there are some types which cannot be inferred.
 * Also, a user might choose to specify a type when constructing a new GeneralNumber - so we need to check the type they've specified is actually correct for the input value.
 */
const checkType = (value, purportedType) => {
  const type = purportedType;
  let pass;
  switch (type) {
    default:
      pass = purportedType === inferType(value);
      break;
    case 'hex':
      // allow non-0x-prefixed hex values if user has explicitly passed `type = 'hex'` to the GeneralNumber constructor:
      pass = isHex(ensure0x(value));
      break;
    case 'binary':
      // allow binary values if user has explicitly passed `type = 'binary'` to the GeneralNumber constructor:
      pass = /^[0-1]+$/.test(value);
      break;
  }
  if (!pass)
    throw new Error(`Type check failure. Input value ${value} is not of purported type ${type}.`);
};

/*
 * Stitches limbs back together
 * @returns {string} a hex string representing the limbs
 */
export const stitchLimbs = limbs => {
  const hexLimbs = limbs.map(limb => convertToHex(limb, inferType(limb)));
  return hexLimbs.reduce((acc, cur) => {
    return acc.concat(strip0x(cur));
  }, '0x');
};

const convertToHex = (value, type) => {
  switch (type) {
    default:
      throw new Error(`invalid type "${type}"`);
    case 'hex':
      return ensure0x(value);
    case 'binary':
      return binToHex(value);
    case 'decimal':
    case 'integer':
    case 'number':
      return decToHex(value.toString());
    case 'bigint':
      return ensure0x(value.toString(16));
    case 'boolean':
      return value ? '0x01' : '0x00';
    case 'ascii':
      return asciiToHex(value);
    case 'utf8':
      return utf8ToHex(value);
    case 'limbs':
      return stitchLimbs(value);
  }
};

/**
 * This class defines a 'general' number.  That's basically an object that can return a conversion of the original number into another common type: 'hex', 'integer', 'decimal', 'number', 'binary', 'bigint', 'boolean', 'ascii', 'utf8', 'limbs'.
 *
 * @param {string} value the input value
 * @param {string} type enum:
 *  OPTIONAL types (can be inferred otherwise): ['hex', 'integer', 'decimal', 'number', 'bigint', 'boolean', 'ascii', 'utf8', 'limbs']
 * Note: 'hex' values can only be inferred if they have an '0x' prefix).
 * Note: 'limbs' are arrays of values (arranged in big endian order).
 * Note: 'limbs' containing binary values are NOT supported.
 *
 * EXPLICIT types (cannot be inferred, so must be specified): ['binary']
 *
 * @warning The `new GeneralNumber()` constructor infers DIFFERENTLY from the `generalise()` function. E.g. `generalise()` cannot infer 'limbs' values as 'limbs'. See details on the `inferType()` and `generalise()` functions.
 */
export class GeneralNumber {
  constructor(value, type) {
    if (value === undefined) throw new Error('Input value is undefined');
    if (value === '') throw new Error('Input is empty');
    if (type) {
      checkType(value, type);
    } else {
      type = inferType(value); // eslint-disable-line no-param-reassign
    }
    // regardless of the input type, we convert it to hex and store it as hex:
    this._hex = convertToHex(value, type);
  }

  get binary() {
    return hexToBin(this._hex);
  }

  get binaryArray() {
    return hexToBinArray(this._hex);
  }

  get bytes() {
    return hexToBytes(this._hex);
  }

  // returns the decimal representation, as a String type. Synonymous with `integer()`.
  get decimal() {
    return hexToDec(this._hex);
  }

  // returns the decimal representation, as a String type. Synonymous with `decimal()`.
  get integer() {
    return hexToDec(this._hex);
  }

  // returns the decimal representation, as a Number type (if less than javascript's MAX_SAFE_INTEGER). (Otherwise it will throw).
  get number() {
    const int = hexToDec(this._hex);
    const num = Number(int);
    if (num > Number.MAX_SAFE_INTEGER)
      throw new Error(`Cannot safely coerce int=${int} into a js Number(int)=${num}`);
    return num;
  }

  get bigInt() {
    return BigInt(this._hex);
  }

  get booleam() {
    switch (BigInt(this._hex)) {
      default:
        throw new Error(`${this._hex} cannot be converted to boolean`);
      case 1:
        return true;
      case 0:
        return false;
    }
  }

  get ascii() {
    return hexToAscii(this._hex);
  }

  get utf8() {
    return hexToUtf8(this._hex);
  }

  // Safe fallback for accidentally calling '.all' on a GeneralNumber (rather than a GeneralObject, which actuallty supports this property)
  get all() {
    return this;
  }

  // returns a limbed value. Inspired by 'u32' type notation.
  limbs(
    limbBitLength, //
    numberOfLimbs = undefined,
    returnType = 'decimal',
    throwErrors = false,
  ) {
    if (!limbBitLength) throw new Error('limbBitLength not specified');
    switch (returnType) {
      default:
        throw new Error(`unsupported return type "${returnType}"`);
      case 'hex':
        return hexToLimbs(
          this._hex, //
          limbBitLength,
          numberOfLimbs,
          throwErrors,
        );
      case 'decimal':
      case 'integer':
      case 'number':
        return hexToDecLimbs(
          this._hex, //
          limbBitLength,
          numberOfLimbs,
          throwErrors,
        );
    }
  }

  /**
  @param {String} byteLength - the byte-length of the number.
  @param {String} butTruncateValueToByteLength - OPTIONAL - we can truncate the value to be a smaller byte size, whilst still returning a string of length byteLength (padded with zeros)
  e.g.
  const myGN = new GN('0x12345678') // 4 bytes
  console.log(myGN.hex(4)) // '0x12345678'
  console.log(myGN.hex(3)) // '0x345678'
  console.log(myGN.hex(5)) // '0x0012345678'
  console.log(myGN.hex(5, 4)) // '0x0012345678'
  console.log(myGN.hex(5, 3)) // '0x0000345678'
  console.log(myGN.hex(4, 5)) // 'ERROR'
  */
  hex(byteLength, butTruncateValueToByteLength = 0) {
    let result = this._hex;
    if (byteLength) {
      if (butTruncateValueToByteLength) {
        if (butTruncateValueToByteLength > byteLength)
          throw new Error(
            `butTruncateValueToByteLength (${butTruncateValueToByteLength}) > byteLength (${byteLength})`,
          );
        result = resizeHex(result, 2 * butTruncateValueToByteLength);
      }
      result = resizeHex(result, 2 * byteLength);
    }
    return result;
  }

  field(modulus) {
    if (!modulus) throw new Error('no field modulus specified');
    return hexToField(this._hex, modulus, true);
  }
}

// Add a new hidden property '.all' to the object/array, which returns a GeneralObject. A GeneralObject allows us to collapse all items in the object/array into the same type.
const attachPropertyAll = thing => {
  try {
    Object.defineProperty(thing, 'all', {
      get() {
        return new GeneralObject(thing);
      },
      configurable: true,
    });
  } catch (err) {
    console.error(`Error adding property '.all' to this:`);
    console.dir(thing, { depth: null });
    throw new Error(err);
  }
};

export const generalise = thing => {
  if (typeof thing === 'undefined') {
    return thing;
  }
  if (thing instanceof GeneralNumber) {
    return thing;
  }
  if (typeof Object(thing).valueOf() === 'bigint') {
    // a bigint is not to be confused with a regular object, and so this check must come first
    return new GN(thing);
  }
  if (typeof thing === 'object') {
    const result = Array.isArray(thing) ? [] : {};
    for (const [key, value] of Object.entries(thing)) {
      result[key] = generalise(value);
    }
    attachPropertyAll(result);
    return result;
  }
  return new GN(thing);
};

/**
@param {object || array} _object
@param {string} type
@param {array} args - OPTIONAL
*/
const convert = (thing, type, args) => {
  if (typeof thing !== 'object')
    throw new Error(`Attempting to 'convert' something other than an object/array: ${thing}`);

  const result = Array.isArray(thing) ? [] : {};

  for (const [key, value] of Object.entries(thing)) {
    if (value instanceof GeneralNumber) {
      // each value is a GeneralNumber
      result[key] = typeof value[type] === 'function' ? value[type](...args) : value[type];
    } else result[key] = convert(value, type, args);
  }

  return result;
};

/**
Create a GeneralObject; an object where each key is a GeneralNumber. Whilst the `generalise()` function can achieve this too, a GeneralObject's getters form a convenience way of "collapsing" all of the generalised object's keys _back_ into a particular type.
E.g.
const myGO = new GeneralObject(myObject);
console.log(myGO.hex(64)); // collapses all keys of the object into hex values of length 64.
*/
export class GeneralObject {
  constructor(object) {
    this._object = generalise(object);
  }

  get object() {
    return this._object;
  }

  get binary() {
    return convert(this._object, 'binary');
  }

  get binaryArray() {
    return convert(this._object, 'binaryArray');
  }

  get bytes() {
    return convert(this._object, 'bytes');
  }

  get decimal() {
    return convert(this._object, 'integer');
  }

  get integer() {
    return convert(this._object, 'decimal');
  }

  get number() {
    return convert(this._object, 'number');
  }

  get bigInt() {
    return convert(this._object, 'bigInt');
  }

  get ascii() {
    return convert(this._object, 'ascii');
  }

  get utf8() {
    return convert(this._object, 'utf8');
  }

  limbs(limbBitLength, numberOfLimbs, returnType, throwErrors) {
    return convert(this._object, 'limbs', [
      limbBitLength, //
      numberOfLimbs,
      returnType,
      throwErrors,
    ]);
  }

  hex(byteLength, butTruncateValueToByteLength = 0) {
    return convert(this._object, 'hex', [
      byteLength, //
      butTruncateValueToByteLength,
    ]);
  }

  field(modulus) {
    return convert(this._object, 'field', [modulus]);
  }
}

export const GN = GeneralNumber;
export const GO = GeneralObject;
