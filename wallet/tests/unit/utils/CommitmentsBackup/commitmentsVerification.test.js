import isCommitmentsCPKDMatchDerivedKeys from '../../../../src/utils/CommitmentsBackup/commitmentsVerification';

const wrongCommitments = [
  {
    table: 'commitments',
    rows: [
      { _id: '1', value: '1', preimage: { compressedZkpPublicKey: '500' } },
      { _id: '2', value: '2', preimage: { compressedZkpPublicKey: '200' } },
      { _id: '3', value: '3', preimage: { compressedZkpPublicKey: '100' } },
    ],
  },
];

const mockObject = [
  {
    table: 'commitments',
    rows: [
      { _id: '1', value: '1', preimage: { compressedZkpPublicKey: '100' } },
      { _id: '2', value: '2', preimage: { compressedZkpPublicKey: '200' } },
      { _id: '3', value: '3', preimage: { compressedZkpPublicKey: '100' } },
    ],
  },
];

describe('This suit test should insert some keys in a fake indexedDB and test the verification between commitmnets compressedZkpPublicKeys and these fake derived keys', () => {
  let objResult;
  beforeAll(async () => {
    objResult = ['100', '200', '300'];
  });
  test('Should expect true because we are passing only commitments that match with the derived keys', async () => {
    const isMatch = await isCommitmentsCPKDMatchDerivedKeys(objResult, mockObject[0].rows);
    expect(isMatch).toEqual(true);
  });
  test('Should expect false because we are passing commitments that not match with the derived keys', async () => {
    const isMatch = await isCommitmentsCPKDMatchDerivedKeys(objResult, wrongCommitments[0].rows);
    expect(isMatch).toEqual(false);
  });
});
