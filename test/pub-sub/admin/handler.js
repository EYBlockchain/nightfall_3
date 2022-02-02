'use strict';

const AWS = require('aws-sdk');
const iot = new AWS.Iot();
const sts = new AWS.STS();
const roleName = 'nightfall-publisher';

module.exports.auth = (event, context, callback) => {

    // get the endpoint address
    iot.describeEndpoint({ endpointType: 'iot:Data-ATS' }, (err, data) => {
        if (err) return callback(err);

        const iotEndpoint = data.endpointAddress;
        const region = getRegion(iotEndpoint);

        // get the account id which will be used to assume a role
        sts.getCallerIdentity({}, (err, data) => {
            if (err) return callback(err);

            const params = {
                RoleArn: `arn:aws:iam::${data.Account}:role/${roleName}`,
                RoleSessionName: getRandomInt().toString()
            };

            // assume role returns temporary keys
            sts.assumeRole(params, (err, data) => {
                if (err) return callback(err);

                const res =
                    buildResponseObject(iotEndpoint,
                        region,
                        data.Credentials.AccessKeyId,
                        data.Credentials.SecretAccessKey,
                        data.Credentials.SessionToken);
                callback(null, res);
            });
        });
    });
};

const buildResponseObject = (iotEndpoint, region, accessKey, secretKey, sessionToken) => {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            iotEndpoint: iotEndpoint,
            region: region,
            accessKey: accessKey,
            secretKey: secretKey,
            sessionToken: sessionToken
        })
    };
};

const getRegion = (iotEndpoint) => {
    const partial = iotEndpoint.replace('.amazonaws.com', '');
    const iotIndex = iotEndpoint.indexOf('iot');
    return partial.substring(iotIndex + 4);
};

// Get random Int
const getRandomInt = () => {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
};
