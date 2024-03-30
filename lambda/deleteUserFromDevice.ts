
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException,  } from '@aws-sdk/client-dynamodb';

import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
const dynamodb = new DynamoDB({});

 const deleteUserFromDevice = async (event: any, context: any): Promise<any> => {

	try {
		console.log(event);
		
		const userId  = event.queryStringParameters!.userId;
		const deviceId  = event.queryStringParameters!.deviceId;

		await dynamodb.send(
			new DeleteCommand({
			  TableName:  process.env.TABLE_NAME,
			  Key: {
				userId,
				deviceId
			  },
			  ConditionExpression: 'attribute_exists(userId)', // Ensure the item exists before deletion
			})
		  );

		  return { statusCode: 200, body: JSON.stringify({ message: 'User deleted from the device!' }) };
        

	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
  };

export const handler = addCorsResHeaders(deleteUserFromDevice);