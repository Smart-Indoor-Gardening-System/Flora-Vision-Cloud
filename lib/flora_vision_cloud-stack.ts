import * as cdk from 'aws-cdk-lib';
import { aws_lambda } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as apigw2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apigw2Integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';

import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';

export class FloraVisionCloudStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
	

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





	  

	  	
	  const connectWSLambda = new NodejsFunction(this, 'WebSocketLambda', {
		entry: 'lambda/connect.ts',
		handler: 'handler',
		runtime: aws_lambda.Runtime.NODEJS_18_X,
		environment: {
			CONN_TABLE_NAME: wsConnectionTable.tableName
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



	const webSocketApi = new apigw2.WebSocketApi(this, 'websocket-api', {
		connectRouteOptions: {
		  integration: new apigw2Integrations.WebSocketLambdaIntegration('ws-connect-integration', connectWSLambda),
		},
		disconnectRouteOptions: {
		  integration: new apigw2Integrations.WebSocketLambdaIntegration('ws-disconnect-integration', disconnectWSLambda),
		},
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
	
	  //restApi.root.addMethod('POST', new apigw.LambdaIntegration(sendToWSLambda));

  }
  
}


