import { ApiGatewayManagementApi } from 'aws-sdk';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	APIGatewayProxyWebsocketHandlerV2,
  } from 'aws-lambda';


const dynamodb = new DynamoDB({});

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  const payload = JSON.parse(event.body || '{}'); // Assuming device ID is included in the payload
  const deviceId = payload.deviceId || '';

  // Save the connection ID and associate it with the device ID in DynamoDB
  await saveConnectionId(deviceId, connectionId);

  return { statusCode: 200, body: 'Connected.' };
};

const saveConnectionId = async (deviceId: string, connectionId: string): Promise<void> => {
  try {
    await dynamodb.send(
		new PutCommand({
		  TableName:  process.env.CONN_TABLE_NAME,
		  Item: {
			deviceId, 
			connectionId ,
		  },
		})
	  );
  } catch (error) {
    console.error('Error saving connection ID:', error);
    throw error;
  }
};
