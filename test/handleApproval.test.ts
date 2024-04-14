import { handler } from '../lambda/handleApproval';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SQS } from 'aws-sdk';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('aws-sdk', () => ({
    SQS: jest.fn(() => ({
        sendMessage: jest.fn().mockReturnThis(),
        promise: jest.fn()
    }))
}));

const mockDynamoDBSend = DynamoDB.prototype.send as jest.Mock;
const mockSQSSendMessage = SQS.prototype.sendMessage as jest.Mock;

describe('Lambda Handler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

	it('should return 400 if body not existed', async () => {
        const event :any= {
            body: null
        };
		const context:any = {};
        const response = await handler(event, context);

        expect(response.statusCode).toBe(400);
        expect(response.body).toContain('invalid request, you are missing the parameter body');
    });

    it('should return 403 if the user is not authorized', async () => {
        const event:any = {
            body: JSON.stringify({
                action: 'approve',
                rootId: 'rootUserId',
                normalUserId: 'normalUserId',
                deviceId: 'deviceId'
            }),
        };
        const context:any = {};

        mockDynamoDBSend.mockResolvedValueOnce({ Item: { privilege: 'non-root' } });

        const response = await handler(event, context);
        expect(response.statusCode).toBe(403);
        expect(JSON.parse(response.body)).toEqual({ message: 'You are not authorized to perform this action' });
    });

    it('should return 204 if the action is successfully performed', async () => {
        const event:any = {
            body: JSON.stringify({
                action: 'approve',
                rootId: 'rootUserId',
                normalUserId: 'normalUserId',
                deviceId: 'deviceId'
            }),
        };
        const context:any = {};

        mockDynamoDBSend.mockResolvedValueOnce({ Item: { privilege: 'root' } });
        mockDynamoDBSend.mockResolvedValueOnce({ Item: { email: 'normalUser@example.com' } });
        mockDynamoDBSend.mockResolvedValueOnce({ Item: { email: 'rootUser@example.com' } });


        const response = await handler(event, context);
        expect(response.statusCode).toBe(204);
        expect(JSON.parse(response.body)).toEqual({ message: 'Approve status changed! Notifier triggered' });
    });
});


