import { DynamoDB, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, GetCommand, QueryCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	APIGatewayProxyWebsocketHandlerV2,
  } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const connectionId = event.requestContext.connectionId;
	//const deviceId = event.requestContext.
	console.log('MESSAGE EVENT BODY!!!:');
	console.log(event);
	
	 const query = await docClient.send(
		new QueryCommand({
			TableName: process.env.CONN_TABLE_NAME ,
			KeyConditionExpression: 'connectionId = :connectionId',
			ExpressionAttributeValues: {
				':connectionId': connectionId,
			}
		})
	);

	if (!query.Items ) {
		return { statusCode: 400, body: JSON.stringify({message:'no connected client!'}) };
	}
	const promises = query.Items.map(item => {
		const deviceId = item.deviceId;
		return removeEntriesByConnectionId(connectionId, deviceId);
	});

	await Promise.all(promises);
	return { statusCode: 200 };
  } catch (error) {
    console.error('Error handling WebSocket disconnect:', error);
    throw error;
  }
};

const removeEntriesByConnectionId = async (connectionId: string, deviceId: string): Promise<void> => {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName:  process.env.CONN_TABLE_NAME || '',
        Key: {
          connectionId,
		  deviceId
        },
        ConditionExpression: 'attribute_exists(connectionId)', // Ensure the item exists before deletion
      })
    );
  } catch (error) {
    console.error('Error removing entries by connection ID:', error);
    throw error;
  }
};
