
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, GetCommand  } from '@aws-sdk/lib-dynamodb';


import {
	KmsKeyringNode,
	buildClient,
	CommitmentPolicy,
  } from '@aws-crypto/client-node'


  const { encrypt } = buildClient(
	CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT
  )
  const dynamodb = new DynamoDB({});

// triggered when device is opened first time

const getEncryptedPassword = async (devicePassword:string) => {
	const generatorKeyId =
    'arn:aws:kms:us-east-1:696774395662:key/b47ae376-92a6-49e5-9c9c-f383e45c69f0'

  
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



interface EventBody {
	userId: string;
	deviceId: string;
	plantName: string;
	plantType: string;
	password: string;
  }
  
 const setPlant = async (event: any, context: any): Promise<any> => {

	if (!event.body) {
		return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
	  }
	
	try {
		console.log(event);
		const requestBody: EventBody = JSON.parse(event.body);
		const { userId, deviceId, plantName, plantType,password } = requestBody;

		const query = await dynamodb.send(
			new GetCommand({
			  TableName: process.env.USER_DEVICE_TABLE_NAME,
			  Key: {
				userId: userId,
				deviceId: deviceId
			  },
			  ProjectionExpression: 'privilege'
			})
		  );
	  
		  if (!query.Item) {
			return {
			  statusCode: 404,
			  body: JSON.stringify({ message: ' User`s Device not found' }),
			};
		  }
		  if(query.Item.privilege !== 'root'){
			return {
				statusCode: 403,
				body: JSON.stringify({ message: 'You are not a root user!' }),
			  };
		  }
		  const hashedPassword =  await getEncryptedPassword(password);

		const params: any = {
            TableName: process.env.TABLE_NAME,
            Key: {
                ['pk']: deviceId
            },
            UpdateExpression: 'set plantName = :plantName, plantType = :plantType, password = :password',
            ExpressionAttributeValues: {
                ':plantName': plantName,
                ':plantType': plantType,
				':password': hashedPassword
            },
			ConditionExpression: 'attribute_exists(pk)',
            ReturnValues: 'UPDATED_NEW'
        };


	  await dynamodb.send( new UpdateCommand(params));
	  return { statusCode: 204, body: JSON.stringify({ message: 'Plant settings Updated Successfully' }) };

	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
  };

export const handler = addCorsResHeaders(setPlant);