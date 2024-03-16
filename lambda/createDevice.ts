import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { hash } from 'bcryptjs';
const dynamodb = new DynamoDB

// triggered when device is opened first time

export const handler = async (event: any, context: any): Promise<void> => {
	try {
	  console.log(event);
	  const { DeviceID, password } = event;
	  const hashedPassword = await hash(password, 10); // 10 is the salt rounds

	  console.log('Saving device:', DeviceID);
	  

	  await dynamodb.send(
		new PutCommand({
		  TableName: process.env.TABLE_NAME,
		  Item: {
			pk: DeviceID,
			password:hashedPassword,
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
  