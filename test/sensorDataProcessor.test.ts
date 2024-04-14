import { handler } from '../lambda/index';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';


// Mock the DynamoDB client
jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDB: jest.fn(() => ({
        send: jest.fn(), // Mock the send method
    })),
}));

describe('Sensor Data Lambda Handler', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should save sensor data to DynamoDB', async () => {
        const mockSend = jest.fn(); // Mock the send method
        (DynamoDB as jest.Mock).mockImplementation(() => ({
            send: mockSend,
        }));
		// Mock the process.env.CONN_TABLE_NAME
		process.env.CONN_TABLE_NAME = 'mockTableName';
        const event: any = {
            "Humidity": 50,
            "Temperature Celcius": 25,
            "Temperature Fahrenheit": 77,
            "Light Intensity": 500,
            "Soil Moisture": 30,
            "CO": 1,
            "DeviceID": "testDeviceId",
        };
        const context: any = {};

        await handler(event, context);

        expect(PutCommand).toHaveBeenCalledWith({
            TableName:'mockTableName', // Ensure TableName is provided
            Item: {
                sk: expect.any(String), // Ensure sk is provided
                ...event, // Ensure all sensor data properties are provided
            },
        });
    });
});
