
import addCorsResHeaders from '../middlewares/addCorsResHeaders';
import { DynamoDB, ConditionalCheckFailedException,  } from '@aws-sdk/client-dynamodb';

import { DeleteCommand, GetCommand, UpdateCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { rootCertificates } from 'tls';
const dynamodb = new DynamoDB({});

// if candidate item already existed  then update the privilege to root
// if not then create a new item with privilege root

 const deleteUserFromDevice = async (event: any, context: any): Promise<any> => {

	try {
		console.log(event);
		
		const userId  = event.queryStringParameters!.userId;
		const deviceId  = event.queryStringParameters!.deviceId;
		const rootCandidateId = event.queryStringParameters!.rootCandidateId;

		const query = await dynamodb.send(
			new GetCommand({
			  TableName: process.env.TABLE_NAME,
			  Key: {
				userId: userId,
				deviceId: deviceId
			  },
			  ProjectionExpression: 'privilege'
			})
		  );
	  
		  if (!query.Item) {
			return {
			  statusCode: 404,
			  body: JSON.stringify({ message: ' User`s Device not found' }),
			};
		  }

		  if(query.Item.privilege === 'root'){
			await handleRootUserDelete(deviceId, rootCandidateId);
		  }

		await dynamodb.send(
			new DeleteCommand({
			  TableName:  process.env.TABLE_NAME,
			  Key: {
				userId,
				deviceId
			  },
			  ConditionExpression: 'attribute_exists(userId)', // Ensure the item exists before deletion
			})
		  );

		  return { statusCode: 200, body: JSON.stringify({ message: 'User deleted from the device. Root changed successfully!' }) };

	} 
	catch (error: any) {
        if (error instanceof ConditionalCheckFailedException) {
            return { statusCode: 400, body: JSON.stringify({ message: 'Record not found' }) };
        }
        throw error;
    }
  };

const handleRootUserDelete = async ( deviceId: string, rootCandidateId:string) => {
	if(rootCandidateId === undefined){
		// delete all normal users from the device if the root candidate is not provided
		
		const normalUsersDeleteQuery  = await dynamodb.send(
			new QueryCommand({
			  TableName: process.env.TABLE_NAME,
			  IndexName: 'deviceIdIndex', 
			  FilterExpression: 'approveStatus = :approveStatus and privilege = :privilege',
			  KeyConditionExpression: 'deviceId = :deviceId',
			  ExpressionAttributeValues: {
				':deviceId': deviceId,
				':approveStatus': 'approved',
				':privilege': 'normal'
			  }
			})
		  );
		  if(!normalUsersDeleteQuery.Items) return;
		  const normalUsers = normalUsersDeleteQuery.Items;
		  for(const user of normalUsers){
			await dynamodb.send(
				new DeleteCommand({
				  TableName:  process.env.TABLE_NAME,
				  Key: {
					userId: user.userId,
					deviceId
				  },
				  ConditionExpression: 'attribute_exists(userId)'
				}));
		  }
		  await dynamodb.send(
			new DeleteCommand({
			  TableName:  process.env.DEVICE_TABLE_NAME,
			  Key: {
				pk:deviceId
			  },
			  ConditionExpression: 'attribute_exists(pk)'
			}));
		 return;

	}

	const candidateQuery = await dynamodb.send(
		new GetCommand({
		  TableName: process.env.TABLE_NAME,
		  Key: {
			userId: rootCandidateId,
			deviceId: deviceId
		  },
		  
		})
	  );
	  if(!candidateQuery.Item){
		 await dynamodb.send(
			new PutCommand({
				TableName: process.env.TABLE_NAME,
				Item: {
				  userId: rootCandidateId,
				  deviceId,
				  privilege:'root',
				  approveStatus: 'approved',
				},
			  })
		  );
	
	  }
	  else{

		const params: any = {
			TableName: process.env.TABLE_NAME,
			Key: {
				userId: rootCandidateId,
				deviceId
			},
			UpdateExpression: 'set privilege = :privilege, approveStatus = :approveStatus',
			ExpressionAttributeValues: {
				':privilege': 'root',
				':approveStatus': 'approved'
			},
			ConditionExpression: 'attribute_exists(userId)',
			ReturnValues: 'UPDATED_NEW'
		};


	  await dynamodb.send( new UpdateCommand(params));

	  }

};

export const handler = addCorsResHeaders(deleteUserFromDevice);