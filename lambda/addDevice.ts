import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { SQSHandler, SQSMessageAttributes } from 'aws-lambda';

const dynamodb = new DynamoDB({});

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
        await dynamodb.send(
          new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
              userId,
              deviceId
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
