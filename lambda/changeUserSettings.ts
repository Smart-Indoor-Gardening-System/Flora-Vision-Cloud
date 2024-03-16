import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, GetCommand  } from '@aws-sdk/lib-dynamodb';
const dynamodb = new DynamoDB({});

interface EventBody {
	userId: string;
	isNameVisible: boolean;
  }
  

const changeUserSettings = async (event: any, context: any): Promise<any> => {
  try {
    console.log(event);
	if (!event.body) {
		return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
	  }
	
	  try {
		console.log(event);
		const requestBody: EventBody = JSON.parse(event.body);
		const { userId, isNameVisible } = requestBody;

		const query = await dynamodb.send(
			new GetCommand({
			  TableName: process.env.TABLE_NAME,
			  Key: {
				userId: userId
			  },
			  ProjectionExpression: 'isNameVisible'
			})
		  );
	  
		  if (!query.Item) {
			return {
			  statusCode: 404,
			  body: JSON.stringify({ message: ' User`s Device not found' }),
			};
		  }
	

		const params: any = {
            TableName: process.env.TABLE_NAME,
            Key: {
                ['userId']: userId
            },
            UpdateExpression: 'set isNameVisible = :isNameVisible',
            ExpressionAttributeValues: {
                ':isNameVisible': isNameVisible
            },
			ConditionExpression: 'attribute_exists(userId)',
            ReturnValues: 'UPDATED_NEW'
        };


	  await dynamodb.send( new UpdateCommand(params));
	  return { statusCode: 204, body: JSON.stringify({ message: 'User settings Updated Successfully' }) };

	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
 
  } catch (error) {
    console.error('Error settings of user failed:', error);
    throw error;
  }
};


export const handler = addCorsResHeaders(changeUserSettings);