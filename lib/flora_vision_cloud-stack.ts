import * as cdk from 'aws-cdk-lib';
import { aws_lambda, aws_dynamodb as dynamo, Aws} from 'aws-cdk-lib';
import { aws_cognito as cognito, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as apigw2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apigw2Integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as agwa from "@aws-cdk/aws-apigatewayv2-authorizers-alpha";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { ApiKey, ApiKeySourceType, UsagePlan,  Cors } from 'aws-cdk-lib/aws-apigateway'

import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
export class FloraVisionCloudStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
	
	const userPool = new cognito.UserPool(this, 'UserPool', {
		selfSignUpEnabled: true,
		autoVerify: {
		  email: true,
		},
		removalPolicy: RemovalPolicy.DESTROY,
	  });

	  const client = userPool.addClient('Client', {
		authFlows: {
		  userPassword: true,
		  userSrp: true,
		},
	  });

	// Access the user pool and client as needed
    const userPoolId = userPool.userPoolId;
    const clientId = client.userPoolClientId;



   // Create DynamoDB tables
    const sensorDataTable = new Table(this, 'SensorDataTable', {
      partitionKey: { name: 'DeviceID', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Don't use in production!
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

	const userTable = new Table(this, 'UserTable', {
		partitionKey: { name: 'userId', type: AttributeType.STRING },
		removalPolicy: cdk.RemovalPolicy.DESTROY, // Don't use in production!
		billingMode: BillingMode.PAY_PER_REQUEST,
	  });

	// Create Device Table
	const deviceTable = new Table(this, 'DeviceTable', {
		partitionKey: { name: 'pk', type: AttributeType.STRING },
		removalPolicy: cdk.RemovalPolicy.DESTROY, // Don't use in production!
		billingMode: BillingMode.PAY_PER_REQUEST,
	  });

	  const userDeviceTable = new Table(this, 'UserDeviceTable', {
		partitionKey: { name: 'userId', type: AttributeType.STRING },
		sortKey: { name: 'deviceId', type: AttributeType.STRING },
		removalPolicy: cdk.RemovalPolicy.DESTROY, // Don't use in production!
		billingMode: BillingMode.PAY_PER_REQUEST,
	  });

	  userDeviceTable.addGlobalSecondaryIndex({
		partitionKey: { name: "deviceId", type: dynamo.AttributeType.STRING },
		indexName: "deviceIdIndex",
	  });
  
	  const notificationTable = new Table(this, 'NotificationTable', {
		partitionKey: { name: 'userId', type: AttributeType.STRING },
		sortKey: { name: 'notificationId', type: AttributeType.STRING },
		removalPolicy: cdk.RemovalPolicy.DESTROY, // Don't use in production!
		billingMode: BillingMode.PAY_PER_REQUEST,
	  });

	 
	const wsConnectionTable = new Table(this, 'WSConnectionTable', {
		partitionKey: { name: 'connectionId', type: AttributeType.STRING },
		sortKey: {name:'deviceId', type: AttributeType.STRING },
		removalPolicy: cdk.RemovalPolicy.DESTROY, // Don't use in production!
		billingMode: BillingMode.PAY_PER_REQUEST,
	  });

	 wsConnectionTable.addGlobalSecondaryIndex({
		partitionKey: { name: "deviceId", type: dynamo.AttributeType.STRING },
		indexName: "deviceIdIndex",
	  });
  
	// Create Lambda function for saving sensor data to db
    const lambdaFunction = new  NodejsFunction(this, 'SensorDataProcessor', {
	  entry: 'lambda/index.ts',
	  handler: 'handler',
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      environment: {
        TABLE_NAME: sensorDataTable.tableName,
      },
    });

	// Grant Lambda permissions to interact with DynamoDB
    sensorDataTable.grantReadWriteData(lambdaFunction);

	const postConfirmationLambda = new NodejsFunction(this, 'PostConfirmationLambda', {
		entry: 'lambda/postConfirmation.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			TABLE_NAME: userTable.tableName,
		},
	  });


	  userTable.grantReadWriteData(postConfirmationLambda);

	userPool.addTrigger(
		cognito.UserPoolOperation.POST_CONFIRMATION,
		postConfirmationLambda
	  );


	// Create SQS Queue for VerifyDevicePasswordLambda-AddDeviceLambda communication

	const queue = new sqs.Queue(this, 'DeviceVerifyQueue');

	// Create SQS Queue for HandleApproveLambda-ApproveNotierLambda communication
	const approvalQueue = new sqs.Queue(this, 'ApprovalQueue');

	// Lambda functions

	const approveNotifierLambda = new NodejsFunction(this, 'ApproveNotifierLambda', {
		entry: 'lambda/approveNotifier.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment:{
			TABLE_NAME: notificationTable.tableName,
		}
	  });


	const verifyDevicePasswordLambda = new NodejsFunction(this, 'VerifyDevicePasswordLambda', {
		entry: 'lambda/verifyDevicePassword.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			TABLE_NAME: deviceTable.tableName,
			QUEUE_URL: queue.queueUrl
		},
	  });

	  deviceTable.grantReadData(verifyDevicePasswordLambda);

	// Create Lambda function for adding a device
	const addDeviceLambda = new NodejsFunction(this, 'AddDeviceLambda', {
		entry: 'lambda/addDevice.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			TABLE_NAME: userDeviceTable.tableName,
		},
	  });

	  userDeviceTable.grantReadWriteData(addDeviceLambda);
	  // Grant permissions for sender to send messages to SQS queue
	  queue.grantSendMessages(verifyDevicePasswordLambda);

	  // Grant permissions for receiver to receive messages from SQS queue
	  queue.grantConsumeMessages(addDeviceLambda);

	  // Configure SQS as event source for receiver Lambda
	  addDeviceLambda.addEventSource(new SqsEventSource(queue));



	  const createDeviceLambda = new NodejsFunction(this, 'CreateDeviceLambda', {
		entry: 'lambda/createDevice.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			TABLE_NAME: deviceTable.tableName,
		},
	  });

	  deviceTable.grantReadWriteData(createDeviceLambda);

	 const getUsersOfDeviceLambda = new NodejsFunction(this, 'GetUsersOfDeviceLambda', {
		entry: 'lambda/getUsersOfDevice.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			TABLE_NAME: userDeviceTable.tableName,
			USER_TABLE_NAME: userTable.tableName,
		},
	  });

	 userTable.grantReadWriteData(getUsersOfDeviceLambda);
	 userDeviceTable.grantReadWriteData(getUsersOfDeviceLambda);


	const setPlantLambda = new NodejsFunction(this, 'SetPlantLambda', {
	entry: 'lambda/setPlant.ts',
	handler: 'handler',
	runtime: aws_lambda.Runtime.NODEJS_18_X,
	environment: {
		TABLE_NAME: deviceTable.tableName,
		USER_DEVICE_TABLE_NAME: userDeviceTable.tableName,
	},
  });

  deviceTable.grantReadWriteData(setPlantLambda);
  userDeviceTable.grantReadData(setPlantLambda);


  const markAsReadLambda = new NodejsFunction(this, 'markAsReadLambda', {
	entry: 'lambda/markAsRead.ts',
	handler: 'handler',
	runtime: aws_lambda.Runtime.NODEJS_18_X,
	environment: {
		TABLE_NAME: notificationTable.tableName,
	},
  });

 

  notificationTable.grantReadWriteData(markAsReadLambda);

  const getNotificationsLambda = new NodejsFunction(this, 'getNotificationsLambda', {
	entry: 'lambda/getNotifications.ts',
	handler: 'handler',
	runtime: aws_lambda.Runtime.NODEJS_18_X,
	environment: {
		TABLE_NAME: notificationTable.tableName,
	},
  });

  notificationTable.grantReadWriteData(getNotificationsLambda);


	const handleApprovalLambda = new NodejsFunction(this, 'handleApprovalLambda', {
		entry: 'lambda/handleApproval.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			TABLE_NAME: userDeviceTable.tableName,
			USER_TABLE_NAME: userTable.tableName,
			QUEUE_URL: approvalQueue.queueUrl,
		},
	  });
	
	  userDeviceTable.grantReadWriteData(handleApprovalLambda);
	  approvalQueue.grantSendMessages(handleApprovalLambda);
	  userTable.grantReadWriteData(handleApprovalLambda);
	  notificationTable.grantReadWriteData(approveNotifierLambda);


	  // Grant permissions for receiver to receive messages from SQS queue
	 approvalQueue.grantConsumeMessages(approveNotifierLambda);

	  // Configure SQS as event source for receiver Lambda
	  approveNotifierLambda.addEventSource(new SqsEventSource(approvalQueue));


	const  editDeviceLambda = new NodejsFunction(this, 'editDeviceLambda', {
		entry: 'lambda/editDevice.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			TABLE_NAME: deviceTable.tableName,
			USER_DEVICE_TABLE_NAME: userDeviceTable.tableName,
		},
	  });

	  deviceTable.grantReadWriteData(editDeviceLambda);
	  userDeviceTable.grantReadWriteData(editDeviceLambda);

  const changeUserSettingsLambda =  new NodejsFunction(this, 'ChangeUserSettingsLambda', {
	entry: 'lambda/changeUserSettings.ts',
	handler: 'handler',
	runtime: aws_lambda.Runtime.NODEJS_18_X,
	environment: {
		TABLE_NAME: userTable.tableName
	},
  });

  userTable.grantReadWriteData(changeUserSettingsLambda);

  const getDevicesLambda =  new NodejsFunction(this, 'GetDevicesLambda', {
	entry: 'lambda/getDevices.ts',
	handler: 'handler',
	runtime: aws_lambda.Runtime.NODEJS_18_X,
	environment: {
		TABLE_NAME: userDeviceTable.tableName,
		DEVICE_TABLE_NAME: deviceTable.tableName,
	},
  });

  userDeviceTable.grantReadWriteData(getDevicesLambda);
  deviceTable.grantReadWriteData(getDevicesLambda);

  const deleteUserFromDeviceLambda =  new NodejsFunction(this, 'DeleteUserFromDeviceLambda', {
	entry: 'lambda/deleteUserFromDevice.ts',
	handler: 'handler',
	runtime: aws_lambda.Runtime.NODEJS_18_X,
	environment: {
		TABLE_NAME: userDeviceTable.tableName,
		DEVICE_TABLE_NAME: deviceTable.tableName
	},
  });

  userDeviceTable.grantReadWriteData(deleteUserFromDeviceLambda);
  deviceTable.grantReadWriteData(deleteUserFromDeviceLambda);

  const getUserPrivilegeLambda =  new NodejsFunction(this, 'GetUserPrivilegeLambda', {
	entry: 'lambda/getUserPrivilege.ts',
	handler: 'handler',
	runtime: aws_lambda.Runtime.NODEJS_18_X,
	environment: {
		TABLE_NAME: userDeviceTable.tableName,
	},
  });

  userDeviceTable.grantReadWriteData(getUserPrivilegeLambda);

  const getSensorDataLambda =  new NodejsFunction(this, 'GetSensorDataLambda', {
	entry: 'lambda/getSensorData.ts',
	handler: 'handler',
	runtime: aws_lambda.Runtime.NODEJS_18_X,
	environment: {
		TABLE_NAME: sensorDataTable.tableName,
		USER_DEVICE_TABLE_NAME: userDeviceTable.tableName,
	},
  });

  sensorDataTable.grantReadWriteData(getSensorDataLambda);
  userDeviceTable.grantReadWriteData(getSensorDataLambda);
	const authLambda =new NodejsFunction(this, 'AuthorizerLambda', {
		entry: 'lambda/authorizer.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			USER_POOL_ID: userPoolId,
			APP_CLIENT_ID: clientId,
			NODE_OPTIONS: '--enable-source-maps'
		},
	  });
	

	  const connectWSLambda = new NodejsFunction(this, 'WebSocketLambda', {
		entry: 'lambda/connect.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			CONN_TABLE_NAME: wsConnectionTable.tableName,
			NODE_OPTIONS: '--enable-source-maps',
		},
	  });


	wsConnectionTable.grantReadWriteData(connectWSLambda);

	const disconnectWSLambda = new NodejsFunction(this, 'WebSocketDisconnectLambda', {
		entry: 'lambda/disconnect.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			CONN_TABLE_NAME: wsConnectionTable.tableName,
		},
	  });
	
	  // Grant Lambda permissions to interact with DynamoDB
	wsConnectionTable.grantReadWriteData(disconnectWSLambda);

	const authorizer = new agwa.WebSocketLambdaAuthorizer("_Authorizer", authLambda, {
		identitySource: [ 'route.request.querystring.access_token'],
	  });
 

	const webSocketApi = new apigw2.WebSocketApi(this, 'websocket-api', {
		connectRouteOptions: {
		  authorizer,
		  integration: new apigw2Integrations.WebSocketLambdaIntegration('ws-connect-integration', connectWSLambda),
		  
		},
		disconnectRouteOptions: {
		  integration: new apigw2Integrations.WebSocketLambdaIntegration('ws-disconnect-integration', disconnectWSLambda),
		},
	  });
  
	  webSocketApi.addRoute('authorizer', {
		integration: new apigw2Integrations.WebSocketLambdaIntegration('ws-auth-integration', authLambda)
	  });
	  const webSocketStage = new apigw2.WebSocketStage(this, 'websocket-stage', {
		webSocketApi: webSocketApi,
		stageName: 'prod',
		autoDeploy: true,
	  });

	  const restApi = new apigw.RestApi(this, 'rest-api', {
		deployOptions: {
		  stageName: 'prod',
		},
		deploy: true,
		defaultCorsPreflightOptions: {
		allowOrigins: Cors.ALL_ORIGINS,
	     allowMethods: Cors.ALL_METHODS
		},
		apiKeySourceType: ApiKeySourceType.HEADER,
	  });

	  const apiKey = new ApiKey(this, 'ApiKey');
 
	  const usagePlan = new UsagePlan(this, 'UsagePlan', {
		name: 'Usage Plan',
		  apiStages: [
			{
			  api:restApi,
			  stage: restApi.deploymentStage,
		   },
		   ],
		});
		usagePlan.addApiKey(apiKey);
	  const addDeviceResource = restApi.root.addResource('addDevice');
	  addDeviceResource.addMethod(
		'POST',
		new apigw.LambdaIntegration(verifyDevicePasswordLambda),
		{
		 apiKeyRequired: true,
		 methodResponses: [{
			statusCode: '200',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,

			},
		  }],
		},
	  );

	  const setPlantResource = restApi.root.addResource('setPlant');
	  setPlantResource.addMethod(
		'PUT',
		new apigw.LambdaIntegration(setPlantLambda),
		{
		  methodResponses: [{
			statusCode: '204',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );

	  const markAsReadResource = restApi.root.addResource('markAsRead');
	  markAsReadResource.addMethod(
		'PUT',
		new apigw.LambdaIntegration(markAsReadLambda),
		{
		  methodResponses: [{
			statusCode: '204',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );

	  const handleApprovalResource = restApi.root.addResource('handleApproval');
	  handleApprovalResource.addMethod(
		'PUT',
		new apigw.LambdaIntegration(handleApprovalLambda),
		{
		  methodResponses: [{
			statusCode: '204',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );


	  const editDeviceResource = restApi.root.addResource('editDevice');
	  editDeviceResource.addMethod(
		'PUT',
		new apigw.LambdaIntegration(editDeviceLambda),
		{
		  methodResponses: [{
			statusCode: '204',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );

	  const changeUserSettingsResource = restApi.root.addResource('changeUserSettings');
	  changeUserSettingsResource.addMethod(
		'PUT',
		new apigw.LambdaIntegration(changeUserSettingsLambda),
		{
		  methodResponses: [{
			statusCode: '204',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );

	  const getDevicesResource = restApi.root.addResource('getDevices');
	  getDevicesResource.addMethod(
		'GET',
		new apigw.LambdaIntegration(getDevicesLambda),
		{
		  methodResponses: [{
			statusCode: '200',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );

	  const getNotificationsResource = restApi.root.addResource('getNotifications');
	  getNotificationsResource.addMethod(
		'GET',
		new apigw.LambdaIntegration(getNotificationsLambda),
		{
		  methodResponses: [{
			statusCode: '200',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );


	  const getSensorDataResource = restApi.root.addResource('getSensorData');
	  getSensorDataResource.addMethod(
		'GET',
		new apigw.LambdaIntegration(getSensorDataLambda),
		{
		  methodResponses: [{
			statusCode: '200',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );


	  const getUserPrivilegeResource = restApi.root.addResource('getUserPrivilege');
	  getUserPrivilegeResource.addMethod(
		'GET',
		new apigw.LambdaIntegration(getUserPrivilegeLambda),
		{
		  methodResponses: [{
			statusCode: '200',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );


	  const getUsersOfDeviceResource = restApi.root.addResource('getUsersOfDevice');
	  getUsersOfDeviceResource.addMethod(
		'GET',
		new apigw.LambdaIntegration(getUsersOfDeviceLambda),
		{
		  methodResponses: [{
			statusCode: '200',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );

	  const deleteUserFromDeviceResource = restApi.root.addResource('deleteUserFromDevice');
	  deleteUserFromDeviceResource.addMethod(
		'DELETE',
		new apigw.LambdaIntegration(deleteUserFromDeviceLambda),
		{
		  methodResponses: [{
			statusCode: '200',
			responseParameters: {
			  'method.response.header.Content-Type': true,
			  'method.response.header.Access-Control-Allow-Origin': true,
			  'method.response.header.Access-Control-Allow-Methods': true,
			},
		  }],
		},
	  );


	  const sendToWSLambda = new NodejsFunction(this, 'SendToWebSocketLambda', {
		entry: 'lambda/send-to-websocket-handler.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
		  WS_API_ENDPOINT: `https://${webSocketApi.apiId}.execute-api.us-east-1.amazonaws.com/${webSocketStage.stageName}`,
		  CONN_TABLE_NAME: wsConnectionTable.tableName,
		},
	  });
  
	  
	  wsConnectionTable.grantReadData(sendToWSLambda);
	  webSocketApi.grantManageConnections(sendToWSLambda);

	
	authLambda.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com', {
		conditions: {
		  "ArnLike": {
			"aws:SourceArn": `arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:ycalx2jfg3/*`
		  }
		}
	  }));

	authLambda.role?.grantAssumeRole(new ServicePrincipal("apigateway.amazonaws.com"))
	connectWSLambda.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com', {
		conditions: {
		  "ArnLike": {
			"aws:SourceArn": `arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:ycalx2jfg3/*`
		  }
		}
	  }));

	connectWSLambda.role?.grantAssumeRole(new ServicePrincipal("apigateway.amazonaws.com"))

	  //restApi.root.addMethod('POSTT', new apigw.LambdaIntegration(sendToWSLambda));
	  new cdk.CfnOutput(this, 'API Key ID', {
		value: apiKey.keyId,
	  });
  }
  
}


