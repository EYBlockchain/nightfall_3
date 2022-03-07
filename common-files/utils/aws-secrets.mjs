import AWS from 'aws-sdk';

const { REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;

async function getAwsParameter(parameter, encryption) {
  // Create a Secrets Manager client
  const ssm = new AWS.SSM({
    region: REGION,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  });
  const params = {
    Name: parameter,
    WithDecryption: encryption,
  };

  const data = await ssm.getParameter(params).promise();
  return data.Parameter.Value;
}

export default getAwsParameter;
