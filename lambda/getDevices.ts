
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException,  } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient  } from '@aws-sdk/client-dynamodb';
import { QueryCommand,  DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

 const getDevices = async (event: any, context: any): Promise<any> => {


	
	try {
		console.log(event);
		
		const userId  = event.queryStringParameters!.userId;

		const query = await docClient.send(
            new QueryCommand({
                TableName: process.env.TABLE_NAME,
				KeyConditionExpression: 'userId = :userId',
				ExpressionAttributeValues: {
					':userId': userId,
				}
            })
        );

	if (!query.Items ) {
		return { statusCode: 400, body: JSON.stringify({devices:[]}) };
	} 
	const devicePromises = query.Items.map(device => {
		const deviceParams = {
			TableName: process.env.DEVICE_TABLE_NAME, // Your Device table name
			Key: { pk: device.deviceId  },// Query condition based on deviceId as partition key
			ProjectionExpression: 'pk,plantName,plantType,battery,description'
		};
		const getDeviceCommand = new GetCommand(deviceParams);
		return client.send(getDeviceCommand);
	});

	// Execute all device queries in parallel
	const deviceResponses = await Promise.all(devicePromises);

	// Extract device attributes from each response
	const devices = deviceResponses.map(response => response.Item);

	  return { statusCode: 200, body: JSON.stringify({devices}) };

	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
  };

export const handler = addCorsResHeaders(getDevices);