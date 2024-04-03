import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const dynamodb = new DynamoDB({});

interface SensorData {
  "Humidity": number,
  "Temperature Celcius": number,
  "Temperature Fahrenheit": number,
  "Light Intensity": number,
  "Soil Moisture": number,
  "CO": number,
  "DeviceID": string,
}

export const handler = async (event: any, context: any): Promise<void> => {
  try {
    console.log("HELLO EVENT: ");
    console.log(JSON.stringify(event, null, 2));

    // Directly access the properties of the event object
    const sensorData: SensorData = event;

    // Additional logic for processing and storing data in DynamoDB
    const uuid = randomUUID();
    await dynamodb.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          sk: new Date().toISOString(),
          ...sensorData,
        },
      })
    );
  } catch (error) {
    console.error('Error processing sensor data:', error);
    throw error;
  }
};
