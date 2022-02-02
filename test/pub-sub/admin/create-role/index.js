/* eslint-disable consistent-return */
const AWS = require('aws-sdk');

const iam = new AWS.IAM();
const sts = new AWS.STS();
const roleName = 'nightfall-publisher';

// get the account id
sts.getCallerIdentity({}, (err, data) => {
  if (err) return console.log(err, err.stack);

  const createRoleParams = {
    AssumeRolePolicyDocument: `{
      "Version":"2012-10-17",
      "Statement":[{
          "Effect": "Allow",
          "Principal": {
            "AWS": "arn:aws:iam::${data.Account}:root"
          },
          "Action": "sts:AssumeRole"
        }
      ]
    }`,
    RoleName: roleName,
  };

  // create role
  iam.createRole(createRoleParams, () => {
    if (err) return console.log(err, err.stack);

    const attachPolicyParams = {
      PolicyDocument: `{
        "Version": "2012-10-17",
        "Statement": [{
          "Action": ["iot:Connect", "iot:Subscribe", "iot:Publish", "iot:Receive"],
          "Resource": "*",
          "Effect": "Allow"
        }]
      }`,
      PolicyName: roleName,
      RoleName: roleName,
    };

    // add iot policy
    iam.putRolePolicy(attachPolicyParams, () => {
      if (err) console.log(err, err.stack);
      else console.log(`Finished creating IoT Role: ${roleName}`);
    });
  });
});
