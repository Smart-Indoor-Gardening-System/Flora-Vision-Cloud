
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException,  } from '@aws-sdk/client-dynamodb';

import { DeleteCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
const dynamodb = new DynamoDB({});

 const deleteUserFromDevice = async (event: any, context: any): Promise<any> => {

	try {
		console.log(event);
		
		const userId  = event.queryStringParameters!.userId;
		const deviceId  = event.queryStringParameters!.deviceId;
		const privilege  = event.queryStringParameters!.privilege;
		const rootCandidateId = event.queryStringParameters!.rootCandidateId;

		const query = await dynamodb.send(
			new GetCommand({
			  TableName: process.env.TABLE_NAME,
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
		 
		  if(query.Item.privilege !== privilege){
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Privilege does not match. You are not a root user!' }),
			  };
		  }

		  if(query.Item.privilege === 'root'){

			const params: any = {
				TableName: process.env.TABLE_NAME,
				Key: {
					userId: rootCandidateId,
					deviceId
				},
				UpdateExpression: 'set privilege = :privilege',
				ExpressionAttributeValues: {
					':privilege': 'root',
				},
				ConditionExpression: 'attribute_exists(userId)',
				ReturnValues: 'UPDATED_NEW'
			};
	
	
		  await dynamodb.send( new UpdateCommand(params));
		  }


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