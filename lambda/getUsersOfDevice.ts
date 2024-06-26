
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException,  } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient  } from '@aws-sdk/client-dynamodb';
import { QueryCommand,  DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

 const getUsersOfDevice = async (event: any, context: any): Promise<any> => {

	try {
		console.log(event);
		
		const deviceId  = event.queryStringParameters!.deviceId;
		const clientId = event.queryStringParameters!.clientId;
		const approveStatus  = event.queryStringParameters!.approveStatus;

		const query = await docClient.send(
			new QueryCommand({
			  TableName: process.env.TABLE_NAME,
			  IndexName: 'deviceIdIndex', 
			  FilterExpression: 'approveStatus = :approveStatus',
			  KeyConditionExpression: 'deviceId = :deviceId',
			  ExpressionAttributeValues: {
				':deviceId': deviceId,
				':approveStatus': approveStatus
			  }
			})
		  );

	if (!query.Items ) {
		return { statusCode: 400, body: JSON.stringify({users:[]}) };
	} 
	const userPromises = query.Items.map(user => {
		const deviceParams = {
			TableName: process.env.USER_TABLE_NAME, 
			Key: { userId: user.userId  },
			ProjectionExpression: 'userId,email,isNameVisible'
		};
		const getDeviceCommand = new GetCommand(deviceParams);
		return client.send(getDeviceCommand);
	});

	// Execute all device queries in parallel
	const userResponses = await Promise.all(userPromises);

	// Extract device attributes from each response
	const users = userResponses.map(response => response.Item);

	const privilegeQuery = await client.send(
		new GetCommand({
		  TableName: process.env.TABLE_NAME,
		  Key: {
			userId: clientId,
			deviceId: deviceId
		  },
		  ProjectionExpression: 'privilege'
		})
	  );
  
	  if (!privilegeQuery.Item) {
		return {
		  statusCode: 404,
		  body: JSON.stringify({ message: ' User`s Device not found' }),
		};
	  }

	  const { privilege } = privilegeQuery.Item;
	  if (privilege === 'root') {
		return { statusCode: 200, body: JSON.stringify({users}) };
	  }

	const filteredUsers =  users.filter((user: any) => user.isNameVisible === true);

	  return { statusCode: 200, body: JSON.stringify({users:filteredUsers}) };

	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
  };

export const handler = addCorsResHeaders(getUsersOfDevice);