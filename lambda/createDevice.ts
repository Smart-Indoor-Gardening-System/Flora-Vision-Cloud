import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
// Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
	KmsKeyringNode,
	buildClient,
	CommitmentPolicy,
  } from '@aws-crypto/client-node'

  /* This builds the client with the REQUIRE_ENCRYPT_REQUIRE_DECRYPT commitment policy,
   * which enforces that this client only encrypts using committing algorithm suites
   * and enforces that this client
   * will only decrypt encrypted messages
   * that were created with a committing algorithm suite.
   * This is the default commitment policy
   * if you build the client with `buildClient()`.
   */
  const { encrypt } = buildClient(
	CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT
  )
  const dynamodb = new DynamoDB({});

// triggered when device is opened first time

const getEncryptedPassword = async (devicePassword:string) => {
	const generatorKeyId =
    'arn:aws:kms:us-east-1:696774395662:key/b47ae376-92a6-49e5-9c9c-f383e45c69f0'

  /* Adding alternate KMS keys that can decrypt.
   * Access to kms:Encrypt is required for every CMK in keyIds.
   * You might list several keys in different AWS Regions.
   * This allows you to decrypt the data in any of the represented Regions.
   * In this example, I am using the same CMK.
   * This is *only* to demonstrate how the CMK ARNs are configured.
   */
  const keyIds = [
    'arn:aws:kms:us-east-1:696774395662:key/9f4735a4-1f1e-47ca-9aa5-a5659637bae6',
  ]

  /* The KMS keyring must be configured with the desired CMKs */
  const keyring = new KmsKeyringNode({ generatorKeyId, keyIds })

  
	
	const context = {
		stage: 'prod',
		purpose: 'floravision-auth-device',
		origin: 'us-east-1',
	  }
	/* Encrypt the data. */
	const { result } = await encrypt(keyring, devicePassword, {
	  encryptionContext: context,
	})

	return result;

}

export const handler = async (event: any, context: any): Promise<void> => {
	try {
	  console.log(event);
	  const { DeviceID, password } = event;
	  const hashedPassword =  await getEncryptedPassword(password);

	  console.log('Saving device:', DeviceID);
	  

	  await dynamodb.send(
		new PutCommand({
		  TableName: process.env.TABLE_NAME,
		  Item: {
			pk: DeviceID,
			password:hashedPassword,
			battery:'100',
			plantName:'',
			plantType:'',
		  },
		})
	  );

	} catch (error) {

	  console.error('Error saving device:', error);
	  throw error;
	}
  };
  