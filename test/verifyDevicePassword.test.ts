// Mock DynamoDB client
jest.mock('@aws-sdk/client-dynamodb', () => {
	const mockSend = jest.fn();
	const mockGetCommandResponse = {
	  Item: null, // Default response
	};
  
	return {
	  DynamoDB: jest.fn(() => ({
		send: jest.fn().mockResolvedValue(mockGetCommandResponse),
	  })),
	  GetCommand: jest.fn(),
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


  // Mock KMS client and SQS
  jest.mock('@aws-crypto/client-node', () => {
    let decryptedPassword = 'testPassword'; // Default password
    
    return {
        KmsKeyringNode: jest.fn(() => ({
            encrypt: jest.fn().mockResolvedValue({ result: 'encryptedPassword' }),
        })),
        buildClient: jest.fn(() => ({
            encrypt: jest.fn().mockResolvedValue({ result: 'encryptedPassword' }),
            decrypt: jest.fn().mockImplementation((keyring, password) => {
                // Mock implementation of decrypt function
                return Promise.resolve({ plaintext: decryptedPassword });
            }),
        })),
        setDecryptedPassword: (password:string) => {
            decryptedPassword = password;
        },
        CommitmentPolicy: {
            REQUIRE_ENCRYPT_REQUIRE_DECRYPT: 'REQUIRE_ENCRYPT_REQUIRE_DECRYPT',
        },
    };
});
  
  jest.mock('aws-sdk', () => ({
	SQS: jest.fn(() => ({
	  sendMessage: jest.fn().mockReturnThis(),
	  promise: jest.fn()
	}))
  }));
  
  import { handler } from '../lambda/verifyDevicePassword';
  
  describe('Lambda Handler', () => {
	let event:any;
	let context:any;
  
	beforeEach(() => {
	  event = {
		body: JSON.stringify({
		  userId: 'testUserId',
		  deviceId: 'testDeviceId',
		  password: 'testPassword',
		}),
	  };
	  context = {};
	});
  
	afterEach(() => {
	  jest.clearAllMocks();
	});
  
	it('should return 404 if device not found', async () => {
		require('@aws-sdk/client-dynamodb').setGetCommandResponse(null);
		const response = await handler(event, context);
		expect(response.statusCode).toBe(404);
		expect(JSON.parse(response.body)).toEqual({ message: 'Device not found' });
	  });

	  it('should return 400 if password does not match', async () => {
		require('@aws-sdk/client-dynamodb').setGetCommandResponse({ Item: { password: 'encryptedPassword' } });
		// Set the plaintext to an incorrect password
		require('@aws-crypto/client-node').setDecryptedPassword('incorrectPassword');
	
		const response = await handler(event, context);
		expect(response.statusCode).toBe(400);
		expect(JSON.parse(response.body)).toEqual({ message: 'Password does not match!' });
	  });

	it('should return 200 if password matches and message sent successfully', async () => {
	  require('@aws-sdk/client-dynamodb').setGetCommandResponse({ Item: { password: 'encryptedPassword' } });
	  // Set the plaintext to the correct password
	  require('@aws-crypto/client-node').setDecryptedPassword('testPassword');
	  const response = await handler(event, context);
	  console.log(response)
	  expect(response.statusCode).toBe(200);
	  expect(JSON.parse(response.body)).toEqual({ message: 'Successfully triggered add device Lambda function using queue' });
	});
  });
  