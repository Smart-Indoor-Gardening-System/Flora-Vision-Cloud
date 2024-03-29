import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { SQS } from 'aws-sdk';

import addCorsResHeaders from '../middlewares/addCorsResHeaders';
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
  const {decrypt } = buildClient(
	CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT
  )

const sqs = new SQS();
const dynamodb = new DynamoDB({});

interface EventBody {
  userId: string;
  deviceId: string;
  password: string;
}

const generatorKeyId =
'arn:aws:kms:us-west-2:658956600833:alias/EncryptDecrypt'

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



 const verifyDevicePassword = async (event: any, context: any): Promise<any> => {
	try {
	  console.log(event);
	  const requestBody: EventBody = JSON.parse(event.body);
	  const { userId, deviceId, password } = requestBody;
  
	  const query = await dynamodb.send(
		new GetCommand({
		  TableName: process.env.TABLE_NAME,
		  Key: {
			pk: deviceId,
		  },
		  ProjectionExpression: 'password'
		})
	  );
  
	  if (!query.Item) {
		return {
		  statusCode: 404,
		  body: JSON.stringify({ message: 'Device not found' }),
		};
	  }
  
	  console.log("QUERY ITEM Password: ");
	  console.log(query.Item.password);
  
		const { plaintext, messageHeader } = await decrypt(keyring, query.Item.password);
		if(plaintext.toString() === password){
			const queueUrl: string = process.env.QUEUE_URL as string;
		await sqs.sendMessage({
		  QueueUrl: queueUrl,
		  MessageBody: JSON.stringify({ isDevicePasswordVerified:true, userId, deviceId}),
		  MessageAttributes: {
			AttributeNameHere: {
			  StringValue: 'isDevicePasswordVerified',
			  DataType: 'String',
			},
		  },
		}).promise();
  
		return {
		  statusCode: 200,
		  body: JSON.stringify({ message: 'Successfully triggered add device Lambda function using queue' }),
		};
		}

		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Password does not match!' }),
		  };

		
  
	 
	} catch (error) {
	  console.error('Error adding user`s device:', error);
	  throw error;
	}
  };
  
  export const handler = addCorsResHeaders(verifyDevicePassword);