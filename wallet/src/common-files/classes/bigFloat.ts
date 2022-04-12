type Operands = BigFloat | number | bigint | string;

class BigFloat {
  significand: string; // Part before the decimal

  mantissa: string; // Part after the decimal

  numDecimals: number; // The scaling factor

  constructor(floatVal: number | bigint | string, numDecimals: number) {
    if (typeof floatVal === 'bigint') {
      const stringVal = floatVal.toString().padStart(numDecimals, '0');
      this.significand = stringVal.slice(0, -numDecimals);
      this.mantissa = stringVal.slice(-numDecimals);
      this.numDecimals = numDecimals;
    } else {
      const stringVal: string =
        typeof floatVal === 'string' ? floatVal : floatVal.toFixed(numDecimals);
      const [displaySignificand, displayMantissa] = stringVal.split('.');
      this.mantissa =
        typeof displayMantissa === 'undefined'
          ? '0'.repeat(numDecimals)
          : displayMantissa.padEnd(numDecimals, '0').slice(0, numDecimals);
      this.significand = displaySignificand;
      this.numDecimals = numDecimals;
    }
  }

  toBigInt(): bigint {
    return BigInt(`${this.significand}${this.mantissa}`);
  }

  toString(): string {
    if (this.significand.length === 0) return `0.${this.mantissa}`;
    return `${this.significand}.${this.mantissa}`;
  }

  toFixed(displayDecimals: number): string {
    if (this.significand.length === 0) return `0.${this.mantissa.slice(0, displayDecimals)}`;
    return `${this.significand}.${this.mantissa.slice(0, displayDecimals)}`;
  }

  static parseOperand(operand: Operands, numDecimals: number): BigFloat {
    if (operand instanceof BigFloat) return operand;
    if (typeof operand === 'bigint') return new BigFloat(operand.toString(), numDecimals);
    if (typeof operand === 'string') return new BigFloat(operand, numDecimals);
    // Here typescript is smart enough to know operand is a number now.
    return new BigFloat(operand.toFixed(numDecimals), numDecimals);
  }

  mul(operand: Operands): BigFloat {
    const thisBN = BigInt(`${this.significand}${this.mantissa}`);
    const operandBN: bigint = BigFloat.parseOperand(operand, this.numDecimals).toBigInt();
    const resultedBN: bigint = thisBN * operandBN;
    const scaledBN: bigint = resultedBN / 10n ** BigInt(this.numDecimals); // Anything truncated from this is precision we dont care about anyways.
    return new BigFloat(scaledBN, this.numDecimals);
  }

  add(operand: Operands): BigFloat {
    const thisBN = BigInt(`${this.significand}${this.mantissa}`);
    const operandBN: bigint = BigFloat.parseOperand(operand, this.numDecimals).toBigInt();
    return new BigFloat(thisBN + operandBN, this.numDecimals);
  }
}

export default BigFloat;
