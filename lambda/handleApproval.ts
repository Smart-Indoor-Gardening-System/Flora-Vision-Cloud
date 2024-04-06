// handle User Approval for a device to be a normal user 

import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';


const dynamodb = new DynamoDB({});

interface EventBody {
	action: string;
	rootId: string;
	normalUserId:string;
	deviceId:string;
  }

 const handleApproval = async (event: any, context: any): Promise<any> => {

	if (!event.body) {
		return { statusCode: 400, body: 'invalid request, you are missing the parameter body' };
	  }
	
	try {
		console.log(event);
		const requestBody: EventBody = JSON.parse(event.body);
		const { action, rootId,normalUserId, deviceId } = requestBody;

		const query = await dynamodb.send(
			new GetCommand({
			  TableName: process.env.TABLE_NAME,
			  Key: {
				userId: rootId,
				deviceId: deviceId
			  },
			  ProjectionExpression: 'privilege'
			})
		  );
			if(query.Item?.privilege !== 'root') {
				return { statusCode: 403, body: JSON.stringify({ message: 'You are not authorized to perform this action' }) };
			}

		const params: any = {
            TableName: process.env.TABLE_NAME,
            Key: {
                userId: normalUserId,
				deviceId
            },
            UpdateExpression: 'set approveStatus = :approveStatus',
            ExpressionAttributeValues: {
                ':approveStatus': action,

            },
			ConditionExpression: 'attribute_exists(userId)',
            ReturnValues: 'UPDATED_NEW'
        };


	  await dynamodb.send( new UpdateCommand(params));
	  return { statusCode: 204, body: JSON.stringify({ message: 'Approve status changed!' }) };

	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
  };

export const handler = addCorsResHeaders(handleApproval);