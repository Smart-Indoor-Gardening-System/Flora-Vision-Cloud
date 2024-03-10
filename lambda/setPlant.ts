
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, GetCommand  } from '@aws-sdk/lib-dynamodb';

const dynamodb = new DynamoDB({});

interface EventBody {
	userId: string;
	deviceId: string;
	plantName: string;
	plantType: string;
  }
  
 const setPlant = async (event: any, context: any): Promise<any> => {

	if (!event.body) {
		return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
	  }
	
	try {
		console.log(event);
		const requestBody: EventBody = JSON.parse(event.body);
		const { userId, deviceId, plantName, plantType } = requestBody;

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

		const params: any = {
            TableName: process.env.TABLE_NAME,
            Key: {
                ['pk']: deviceId
            },
            UpdateExpression: 'set plantName = :plantName, plantType = :plantType',
            ExpressionAttributeValues: {
                ':plantName': plantName,
                ':plantType': plantType
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