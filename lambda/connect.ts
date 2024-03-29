import { ApiGatewayManagementApi } from 'aws-sdk';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import {
	APIGatewayProxyHandler,
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	APIGatewayProxyWebsocketHandlerV2,
  } from 'aws-lambda';


const dynamodb = new DynamoDB({});

export const handler: APIGatewayProxyHandler= async (event) => {
  const connectionId = event.requestContext.connectionId!;
  const payload = JSON.parse(event.body || '{}'); // Assuming device ID is included in the payload
  const deviceId = event.queryStringParameters!.deviceId!;
  const userId = event.requestContext.authorizer!.userId;

  // Save the connection ID and associate it with the device ID in DynamoDB
  await saveConnectionId(deviceId, connectionId, userId);

  return { statusCode: 200, body: 'Connected.' };
};

const saveConnectionId = async (deviceId: string, connectionId: string, userId:any): Promise<void> => {
  try {
    await dynamodb.send(
		new PutCommand({
		  TableName:  process.env.CONN_TABLE_NAME,
		  Item: {
			deviceId, 
			connectionId ,
			userId
		  },
		})
	  );
  } catch (error) {
    console.error('Error saving connection ID:', error);
    throw error;
  }
};
