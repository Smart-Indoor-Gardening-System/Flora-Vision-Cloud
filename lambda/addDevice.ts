import { DynamoDBClient  } from '@aws-sdk/client-dynamodb';
import { PutCommand, QueryCommand, DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import { SQSHandler, SQSMessageAttributes } from 'aws-lambda';
import { Role } from '../enums/roles-enum';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: SQSHandler = async (event: any, context: any): Promise<any> => {
  try {
    console.log(event);

    for (const record of event.Records) {
      const messageAttributes: SQSMessageAttributes = record.messageAttributes;
      console.log('Message Attributtes -->  ', messageAttributes.AttributeNameHere.stringValue);
      console.log('Message Body -->  ', record.body);

      const body = JSON.parse(record.body);
      const { userId, deviceId, isDevicePasswordVerified } = body;

      if (isDevicePasswordVerified) {
		var role = Role.normal;
		/*const params = {
			TableName: process.env.TABLE_NAME,
			KeyConditionExpression: 'deviceId = :deviceId AND userId > :userId',
			ExpressionAttributeValues: {
				':deviceId':  deviceId,
				':userId':  userId

			 }
		};
	*/
	/*	const command = new QueryCommand(params);
        const { Items } = await docClient.send(command);
		console.log('Items -->  ');
		console.log(Items);
		if (Items && Items.length === 0) role = Role.root;
	  */
        await docClient.send(
          new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
              userId,
              deviceId,
			  role
            },
          })
        );

        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Device added to corresponding user successfully' }),
        };
      }
    }
  } catch (error) {
    console.error('Error adding user`s device:', error);
    throw error;
  }
};
