// handle User Approval for a device to be a normal user 

import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SQS } from 'aws-sdk';

const sqs = new SQS();
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

			const mailQuery = await dynamodb.send(
				new GetCommand({
				  TableName: process.env.USER_TABLE_NAME,
				  Key: {
					userId: normalUserId,
				  },
				  ProjectionExpression: 'email'
				})
			  );

			  if(!mailQuery.Item) {
				return { statusCode: 400, body: JSON.stringify({ message: 'User not found' }) };
			  }
			  const { email } = mailQuery.Item;

			  const rootMailQuery = await dynamodb.send(
				new GetCommand({
				  TableName: process.env.USER_TABLE_NAME,
				  Key: {
					userId: rootId,
				  },
				  ProjectionExpression: 'email'
				})
			  );

			  if(!rootMailQuery.Item) {
				return { statusCode: 400, body: JSON.stringify({ message: 'Root User Mail not found' }) };
			  }
			  const rootUserMail = rootMailQuery.Item.email;

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

	const queueUrl: string = process.env.QUEUE_URL as string;
	  await dynamodb.send( new UpdateCommand(params));
	  console.log("DEVICE ID: ", deviceId)
	  await sqs.sendMessage({
		QueueUrl: queueUrl,
		MessageBody: JSON.stringify({ notificationPreference:'mail', email, action, userId: normalUserId,rootUserMail,deviceId}),
		MessageAttributes: {
		  AttributeNameHere: {
			StringValue: 'notificationPreference',
			DataType: 'String',
		  },
		},
	  }).promise();
	  return { statusCode: 204, body: JSON.stringify({ message: 'Approve status changed! Notifier triggered' }) };

	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
  };

export const handler = addCorsResHeaders(handleApproval);