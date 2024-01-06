import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamodb = new DynamoDB({});

// Access the WebSocket API URL from environment variables
//const webSocketApiUrl = process.env.WEBSOCKET_API_URL;




const apiGwManApiClient = new ApiGatewayManagementApiClient({
	region: process.env.AWS_REGION,
	endpoint: process.env.WS_API_ENDPOINT,
  });

interface SensorData {
  Humidity: number;
  "Temperature Celcius": number;
  "Temperature Fahrenheit": number;
  "Light Intensity": number;
  "Soil Moisture": number;
  CO: number;
}

export const handler = async (event:any, context: any): Promise<any>  => {
  try {
    console.log('HELLO EVENT: ');
    console.log(JSON.stringify(event, null, 2));

    // Directly access the properties of the event object
    const sensorData: SensorData = event;

    // Retrieve active connections from DynamoDB
   // const connections = await getActiveConnections();

    // Send data to each connected WebSocket clients
   // await Promise.all(connections.map(connectionId => sendToWebSocket(connectionId, sensorData)));
   const scanCommand = new ScanCommand({
    TableName: process.env.CONN_TABLE_NAME,
  });
  const scanCommandResp = await dynamodb.send(scanCommand);
  console.log(`scanCommand resp => ${JSON.stringify(scanCommandResp)}`);

  const textEncoder = new TextEncoder();
  const connectionItems = scanCommandResp.Items || [];

  for (let ind = 0; ind < connectionItems.length; ind++) {
    const postToConnectionCommandResp = await apiGwManApiClient.send(new PostToConnectionCommand({
      ConnectionId: connectionItems[ind].connectionId,
      Data: textEncoder.encode(JSON.stringify(sensorData)),
    }));
    console.log(`postToConnectionCommand resp => ${JSON.stringify(postToConnectionCommandResp)}`);
  }
   
   return {
    statusCode: 200,
    body: JSON.stringify({
      sensorData,
    }),
  };


  } catch (error) {
    console.error('Error processing sensor data:', error);
    throw error;
  }
};



