
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDBClient  } from '@aws-sdk/client-dynamodb';
import { QueryCommand,  DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

 const getSensorData = async (event: any, context: any): Promise<any> => {

	try {
		console.log(event);
		const deviceId  = event.queryStringParameters!.deviceId;
		const timeFrame  = event.queryStringParameters!.timeFrame;

		let startDate = new Date();
		if(timeFrame === 'daily') {
			startDate.setDate(startDate.getDate() - 1);
		}
		else if (timeFrame === 'weekly') {
			startDate.setDate(startDate.getDate() - 7);
		} else if (timeFrame === 'monthly') {
			startDate.setMonth(startDate.getMonth() - 1);
		} else {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: "Invalid timeFrame parameter" })
			};
		}
		

		const query = await docClient.send(
            new QueryCommand({
                TableName: process.env.TABLE_NAME,
				KeyConditionExpression: 'DeviceID = :deviceId and sk > :startDate',
				ExpressionAttributeValues: {
					':deviceId': deviceId,
					':startDate': startDate.toISOString(),
					
				}
            })
        );

	if (!query.Items ) {
		return { statusCode: 400, body: JSON.stringify({data:[]}) };
	} 
	return {
		statusCode: 200,
		body: JSON.stringify({ data: query.Items })
	};
	

	} 
	catch (error: any) {
        throw error;
    }
  };

export const handler = addCorsResHeaders(getSensorData);