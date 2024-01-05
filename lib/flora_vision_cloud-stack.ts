import * as cdk from 'aws-cdk-lib';
import { aws_lambda } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';

export class FloraVisionCloudStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
	

   // Create DynamoDB table
    const sensorDataTable = new Table(this, 'SensorDataTable', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Don't use in production!
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

	// Create Lambda function
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

  }
}
