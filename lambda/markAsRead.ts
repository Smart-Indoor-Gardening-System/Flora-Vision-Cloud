import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
const dynamodb = new DynamoDB({});

interface EventBody {
	userId: string;
	notificationId: string;
	markedStatus: string;
  }

const markAsRead = async (event: any, context: any): Promise<any> => {

	if (!event.body) {
		return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
	  }
	
	  try {
		console.log(event);
		const requestBody: EventBody = JSON.parse(event.body);
		const { userId, notificationId, markedStatus } = requestBody;

		const params: any = {
            TableName: process.env.TABLE_NAME,
            Key: {
                notificationId,
				userId
            },
            UpdateExpression: 'set markedStatus = :markedStatus',
            ExpressionAttributeValues: {
                ':markedStatus': markedStatus,
            },
			ConditionExpression: 'attribute_exists(userId) AND attribute_exists(notificationId)',
            ReturnValues: 'UPDATED_NEW'
        };


	  await dynamodb.send( new UpdateCommand(params));
	  return { statusCode: 204, body: JSON.stringify({ message: 'Mark as Read State Updated Successfully' }) };
	  }catch(err){
		if (err instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw err;
	  }
	
}

export const handler = addCorsResHeaders(markAsRead);