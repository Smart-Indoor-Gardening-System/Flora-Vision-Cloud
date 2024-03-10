import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
const dynamodb = new DynamoDB

// triggered when device is opened first time

export const handler = async (event: any, context: any): Promise<void> => {
	try {
	  console.log(event);
	  const { DeviceID, password } = event;

	  console.log('Saving device:', DeviceID);
	  

	  await dynamodb.send(
		new PutCommand({
		  TableName: process.env.TABLE_NAME,
		  Item: {
			pk: DeviceID,
			password,
			battery:'100',
			plantName:'',
			plantType:'',
		  },
		})
	  );

	} catch (error) {

	  console.error('Error saving device:', error);
	  throw error;
	}
  };
  