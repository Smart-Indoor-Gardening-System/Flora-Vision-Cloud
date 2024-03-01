import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { QueryCommand, PutCommand,  GetCommand } from '@aws-sdk/lib-dynamodb';
const dynamodb = new DynamoDB

export const handler = async (event: any, context: any): Promise<void> => {
	try {
	  console.log(event);
	  const { DeviceID } = event;

	  console.log('Saving device:', DeviceID);

	  await dynamodb.send(
		new PutCommand({
		  TableName: process.env.TABLE_NAME,
		  Item: {
			pk: `${DeviceID}`,
			battery:'45'
		  },
		})
	  );
	} catch (error) {

	  console.error('Error saving device:', error);
	  throw error;
	}
  };
  