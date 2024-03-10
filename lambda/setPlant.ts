
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand  } from '@aws-sdk/lib-dynamodb';



const dynamodb = new DynamoDB({});

interface EventBody {
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
		const { deviceId, plantName, plantType } = requestBody;

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