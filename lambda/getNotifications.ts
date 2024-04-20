
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException,  } from '@aws-sdk/client-dynamodb';
import { DynamoDBClient  } from '@aws-sdk/client-dynamodb';
import { QueryCommand,  DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

 const getNotifications = async (event: any, context: any): Promise<any> => {
	try {
		console.log(event);
		
		const userId  = event.queryStringParameters!.userId;
		const markedStatus  = event.queryStringParameters!.markedStatus;

		const ExpressionAttributeValues : any = {':userId': userId};

		if( isMarkedStatusValid(markedStatus)){
		
			ExpressionAttributeValues[':markedStatus'] = markedStatus;
		}

		const param= { 
			TableName: process.env.TABLE_NAME,
			KeyConditionExpression: 'userId = :userId',
			ExpressionAttributeValues
		} as {
			TableName: string | undefined;
			KeyConditionExpression: string;
			ExpressionAttributeValues: any;
			FilterExpression?: string; 
		};
		
		if( isMarkedStatusValid(markedStatus)){
			param['FilterExpression'] = 'markedStatus = :markedStatus';
		}

		const query = await docClient.send(
            new QueryCommand(param)
        );

	if (!query.Items ) {
		return { statusCode: 400, body: JSON.stringify({notifications:[]}) };
	} 

	const notifications = query.Items;

	  return { statusCode: 200, body: JSON.stringify({notifications}) };

	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
  };

  const isMarkedStatusValid: (markedStatus: string) => boolean = (markedStatus: string) => {
    if (markedStatus === "marked" || markedStatus === "unmarked") return true;
    return false;
};
export const handler = addCorsResHeaders(getNotifications);