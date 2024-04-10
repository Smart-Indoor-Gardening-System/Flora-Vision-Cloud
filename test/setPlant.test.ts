import { handler } from '../lambda/setPlant';

// Mock DynamoDB client
jest.mock('@aws-sdk/client-dynamodb', () => {
	const mockGetCommandResponse = {
	  Item: null, // Default response
	};
  
	return {
	  DynamoDB: jest.fn(() => ({
		send: jest.fn().mockResolvedValue(mockGetCommandResponse),
	  })),
	  ConditionalCheckFailedException: jest.fn(),
	  UpdateCommand: jest.fn(),
	  // Function to dynamically set the response for GetCommand based on the test case
	  setGetCommandResponse: (response:any) => {
		mockGetCommandResponse.Item = response;
	  },
	};
  });
  

jest.mock('@aws-sdk/lib-dynamodb', () => ({
	GetCommand: jest.fn(),
	UpdateCommand: jest.fn()
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
	require('@aws-sdk/client-dynamodb').setGetCommandResponse(null);
    const response = await handler(event, context);
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      message: ' User`s Device not found',
    });
  });

  it('should return 403 if user is not a root user', async () => {
	// Set mock response to privilege: 'normal' for this test case
    require('@aws-sdk/client-dynamodb').setGetCommandResponse({ privilege: 'normal' });
	
	const response = await handler(event, context);
	expect(response.statusCode).toBe(403);
	expect(JSON.parse(response.body)).toEqual({
	  message: 'You are not a root user!',
	});
  });

  it('should return 204 if plant settings are updated successfully', async () => {
    // Mock DynamoDB response for GetCommand
    const mockGetCommandResponse = { privilege: 'root' };
    require('@aws-sdk/client-dynamodb').setGetCommandResponse(mockGetCommandResponse);
  
    // Mock DynamoDB response for UpdateCommand
    const mockUpdateCommandResponse = { Attributes: { /* Updated attributes */ } };
    require('@aws-sdk/client-dynamodb').DynamoDB.prototype.send = jest.fn().mockResolvedValue(mockUpdateCommandResponse);

    const response = await handler(event, context);
    expect(response.statusCode).toBe(204);
    // You can add additional assertions here if necessary
});


  // Add more test cases for other scenarios
});
