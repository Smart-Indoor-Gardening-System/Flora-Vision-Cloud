
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { GetCommand  } from '@aws-sdk/lib-dynamodb';


const dynamodb = new DynamoDB({});

 const getUserPrivilege = async (event: any, context: any): Promise<any> => {

	
	try {
		console.log(event);
		const userId  = event.queryStringParameters!.userId;
		const deviceId  = event.queryStringParameters!.deviceId;

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
		 
			return {
				statusCode: 200,
				body: JSON.stringify({ privilege: query.Item.privilege }),
			  };
	
	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
  };

export const handler = addCorsResHeaders(getUserPrivilege);