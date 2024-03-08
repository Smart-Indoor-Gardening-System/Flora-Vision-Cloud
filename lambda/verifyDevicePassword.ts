import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { SQS } from 'aws-sdk';
import { compare } from 'bcryptjs';

const sqs = new SQS();
const dynamodb = new DynamoDB({});

interface EventBody {
  userId: string;
  deviceId: string;
  password: string;
}

export const handler = async (event: any, context: any): Promise<any> => {
	try {
	  console.log(event);
	  const requestBody: EventBody = JSON.parse(event.body);
	  const { userId, deviceId, password } = requestBody;
  
	  const query = await dynamodb.send(
		new GetCommand({
		  TableName: process.env.TABLE_NAME,
		  Key: {
			pk: deviceId,
		  },
		  ProjectionExpression: 'password'
		})
	  );
  
	  if (!query.Item) {
		return {
		  statusCode: 404,
		  body: JSON.stringify({ message: 'Device not found' }),
		};
	  }
  
	  console.log("QUERY ITEM Password: ");
	  console.log(query.Item.password);
  
	  const result = await new Promise((resolve, reject) => {
		compare(password, query.Item?.password, function(err, result) {
		  if (err) {
			console.error("Error:", err);
			reject(err);
		  }
		  resolve(result);
		});
	  });
  
	  if (result) {
		const queueUrl: string = process.env.QUEUE_URL as string;
		await sqs.sendMessage({
		  QueueUrl: queueUrl,
		  MessageBody: JSON.stringify({ isDevicePasswordVerified:true, userId, deviceId}),
		  MessageAttributes: {
			AttributeNameHere: {
			  StringValue: 'isDevicePasswordVerified',
			  DataType: 'String',
			},
		  },
		}).promise();
  
		return {
		  statusCode: 200,
		  body: JSON.stringify({ message: 'Successfully triggered add device Lambda function using queue' }),
		};
	  } else {
		console.log("Password does not match!");
		return {
		  statusCode: 400,
		  body: JSON.stringify({ message: 'Password does not match!' }),
		};
	  }
  
	} catch (error) {
	  console.error('Error adding user`s device:', error);
	  throw error;
	}
  };
  