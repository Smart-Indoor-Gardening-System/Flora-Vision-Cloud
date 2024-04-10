import { handler } from '../lambda/setPlant';

// Mock DynamoDB client
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDB: jest.fn(() => ({
	send: jest.fn().mockResolvedValue({ Item: null }),
  })),
  ConditionalCheckFailedException: jest.fn(),
  UpdateCommand: jest.fn(),
}));


jest.mock('@aws-sdk/lib-dynamodb', () => ({
	GetCommand: jest.fn(),
  }));

// Mock KMS client
jest.mock('@aws-crypto/client-node', () => ({
  KmsKeyringNode: jest.fn(() => ({
    encrypt: jest.fn().mockResolvedValue({ result: 'encryptedPassword' }),
  })),
  buildClient: jest.fn(() => ({
    encrypt: jest.fn().mockResolvedValue({ result: 'encryptedPassword' }),
  })),
  CommitmentPolicy: {
    REQUIRE_ENCRYPT_REQUIRE_DECRYPT: 'REQUIRE_ENCRYPT_REQUIRE_DECRYPT',
  },
}));

describe('Lambda Handler', () => {
  let event: any;
  let context: any;

  beforeEach(() => {
    event = {
      body: JSON.stringify({
        userId: 'testUserId',
        deviceId: 'testDeviceId',
        plantName: 'testPlantName',
        plantType: 'testPlantType',
        password: 'testPassword',
        description: 'testDescription',
      }),
    };
    context = {};
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if request body is missing', async () => {
    event.body = null;
    const response = await handler(event, context);
	console.log(response);
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual(
     'invalid request, you are missing the parameter body'
);
  });

  it('should return 404 if user device not found', async () => {
    // Mock DynamoDB response for GetCommand
    const mockSend = jest.fn().mockResolvedValue({ Item: null });
    require('@aws-sdk/client-dynamodb').DynamoDB.prototype.send = mockSend;

    const response = await handler(event, context);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      message: ' User`s Device not found',
    });
  });

  // Add more test cases for other scenarios
});
