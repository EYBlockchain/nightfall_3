import gen from 'general-number';

const { generalise } = gen;

class Proof {
  constructor(_proof, curve, scheme) {
    const proof = generalise(_proof).all.bigInt.map(p => p.toString());
    this.protocol = scheme;
    this.curve = curve;
    this.pi_a = [proof[0], proof[1], '1'];
    this.pi_b = [
      [proof[2], proof[3]],
      [proof[4], proof[5]],
      ['1', '0'],
    ];
    this.pi_c = [proof[6], proof[7], '1'];
  }

  static flatProof(proof) {
    const flatArray = generalise(
      [proof.pi_a.slice(0, 2), proof.pi_b.slice(0, 2), proof.pi_c.slice(0, 2)].flat(Infinity),
    ).all.bigInt.map(inp => inp.toString());
    return flatArray;
  }
}

export default Proof;
