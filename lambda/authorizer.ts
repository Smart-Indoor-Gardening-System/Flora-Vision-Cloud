// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { APIGatewayRequestAuthorizerHandler } from "aws-lambda";
import { PolicyDocument } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { APIGatewayAuthorizerResult } from 'aws-lambda/trigger/api-gateway-authorizer';
import 'source-map-support/register';
const UserPoolId = process.env.USER_POOL_ID!;
const AppClientId = process.env.APP_CLIENT_ID!;

const cognitoJwtVerifier = CognitoJwtVerifier.create({
  userPoolId: UserPoolId,
  clientId: AppClientId,
  tokenUse: 'access',
});

export const handler = async function (event: any): Promise<APIGatewayAuthorizerResult> {
  console.log(`event => ${JSON.stringify(event)}`);

  // authentication step by getting and validating JWT token
  const encodedToken = event.queryStringParameters!.access_token!;

  try {
    // @ts-ignore
    const decodedJWT = await cognitoJwtVerifier.verify(encodedToken);

    // After the token is verified we can do Authorization check here if needed.
    // If the request doesn't meet authorization conditions then we should return a Deny policy.
    const policyDocument: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow', // return Deny if you want to reject the request
          Resource: event['methodArn'],
        },
      ],
    };

    // This is the place you inject custom data into request context which will be available
    // inside `event.requestContext.authorizer` in API Lambdas.
    const context = {
      'userId': 123,
      'companyId': 456,
      'role': 'ADMIN',
    };

    const response: APIGatewayAuthorizerResult = {
      principalId: decodedJWT.sub,
      policyDocument,
      context,
    };
    console.log(`response => ${JSON.stringify(response)}`);

    return response;
  } catch (err) {
    console.error('Invalid auth token. err => ', err);
    throw new Error('Unauthorized');
  }
};