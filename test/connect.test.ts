import { handler } from '../lambda/connect';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

jest.mock('@aws-sdk/lib-dynamodb', () => ({
    PutCommand: jest.fn(), // Mock the PutCommand
}));

// Mock the DynamoDB client
jest.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDB: jest.fn(() => ({
        send: jest.fn(), // Mock the send method
    })),
    PutCommand: jest.fn(), // Mock the PutCommand
}));

describe('connect Lambda Handler', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

	it('should save connection ID and return 200', async () => {
        const mockSend = jest.fn(); // Mock the send method
        (DynamoDB as jest.Mock).mockImplementation(() => ({
            send: mockSend,
        }));

		  // Mock the process.env.CONN_TABLE_NAME
		  process.env.CONN_TABLE_NAME = 'mockTableName';

        const event:any = {
            requestContext: {
                connectionId: 'testConnectionId',
            },
            body: JSON.stringify({}), // Assuming an empty payload
            queryStringParameters: {
                deviceId: 'testDeviceId',
                userId: 'testUserId',
            },
        };
		const context:any = {};
		const callback:any = jest.fn();

        const response = await handler(event, context, callback);

        expect(PutCommand).toHaveBeenCalledWith(expect.objectContaining({
            TableName: 'mockTableName', // Expecting any string for TableName
            Item: {
                deviceId: 'testDeviceId',
                connectionId: 'testConnectionId',
                userId: 'testUserId',
            },
        }));

		expect(response).toEqual({ statusCode: 200, body: 'Connected.' });
		
    });
});
