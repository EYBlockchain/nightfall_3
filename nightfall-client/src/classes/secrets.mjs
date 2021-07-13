/**
 A nullifier class
 */
import { generalise } from 'general-number';

class Secrets {
  ephemeralKeys; // random secret used in shared secret creation

  cipherText;

  squareRootsElligator2;

  constructor(randomSecrets, cipherText, squareRootsElligator2) {
    this.ephemeralKeys = generalise(randomSecrets);
    this.cipherText = generalise(cipherText);
    this.squareRootsElligator2 = generalise(squareRootsElligator2);
  }
}

export default Secrets;
