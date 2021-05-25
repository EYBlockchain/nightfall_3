# Example Contracts

These contracts are provided to demonstrate deploying the merkle-tree contracts from this **external** (or 'remote') microservice.

## Deployment locality  

To deploy from **this** 'remote' microservice:

Before deploying, the contracts will need to be compiled (in order to generate the contracts' json interfaces in the `../build/contracts/` folder). The simplest way to do this is with truffle:

```solidity
cd path/to/deployer
truffle compile --all
```

The contracts will then be deployed when this microservice is started with:  
`docker-compose up`.

## Assembly  

Here's an explanation of the hashing function used in the MerkleTree.sol contract:

```
assembly {
    /*
      * gasLimit: calling with gas equal to not(0), as we have here, will send all available gas to the function being called. This removes the need to guess or upper-bound the amount of gas being sent yourself. As an alternative, we could have guessed the gas needed with: sub(gas, 2000)
      * to: the sha256 precompiled contract is at address 0x2: Sending the amount of gas currently available to us (or after subtracting 2000 gas if using the alternative mentioned above);
      * value: 0 (no ether will be sent to the contract)
      * inputOffset: Input data to the sha256 precompiled contract.
      * inputSize: hex input size = 0x40 = 2 x 32-bytes
      * outputOffset: "where will the output be stored?" (in variable 'output' in our case)
      * outputSize: sha256 outputs 256-bits = 32-bytes = 0x20 in hex
    */
    success := call(not(0), 2, 0, inputs, 0x40, output, 0x20)
    // Use "invalid" to make gas estimation work
    switch success case 0 { invalid() }
}
```
