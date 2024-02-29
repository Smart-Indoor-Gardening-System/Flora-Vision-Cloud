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


import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';



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
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Don't use in production!
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

	const wsConnectionTable = new Table(this, 'WSConnectionTable', {
		partitionKey: { name: 'connectionId', type: AttributeType.STRING },
		removalPolicy: cdk.RemovalPolicy.DESTROY, // Don't use in production!
		billingMode: BillingMode.PAY_PER_REQUEST,
		
	  });

	  wsConnectionTable.addGlobalSecondaryIndex({
		partitionKey: { name: "userId", type: dynamo.AttributeType.STRING },
		indexName: "userIdIndex",
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
		  allowMethods: ['POST','GET', 'OPTIONS'],
		  allowOrigins: apigw.Cors.ALL_ORIGINS,
		},
	  });

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

  }
  
}


