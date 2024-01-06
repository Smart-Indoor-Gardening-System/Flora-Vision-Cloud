import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	APIGatewayProxyWebsocketHandlerV2,
  } from 'aws-lambda';

const dynamodb = new DynamoDB({});

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event: APIGatewayProxyWebsocketEventV2): Promise<APIGatewayProxyResultV2> => {
  try {
    const connectionId = event.requestContext.connectionId;

    // Remove all entries with the given connectionId from DynamoDB
    await removeEntriesByConnectionId(connectionId);
	return { statusCode: 200 };
  } catch (error) {
    console.error('Error handling WebSocket disconnect:', error);
    throw error;
  }
};

const removeEntriesByConnectionId = async (connectionId: string): Promise<void> => {
  try {
    await dynamodb.send(
      new DeleteCommand({
        TableName:  process.env.CONN_TABLE_NAME || '',
        Key: {
          connectionId,
        },
        ConditionExpression: 'attribute_exists(connectionId)', // Ensure the item exists before deletion
      })
    );
  } catch (error) {
    console.error('Error removing entries by connection ID:', error);
    throw error;
  }
};
