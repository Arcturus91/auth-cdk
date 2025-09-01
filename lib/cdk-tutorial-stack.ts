import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class CdkTutorialStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Users table for storing user profiles
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'auth-users',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
    });

    // Add GSI for email lookups
    usersTable.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: {
        name: 'email',
        type: dynamodb.AttributeType.STRING
      }
    });

    // Auth Lambda function
    const authHandler = new nodejs.NodejsFunction(this, 'AuthHandler', {
      entry: 'lambda/auth-handler.ts',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        USERS_TABLE_NAME: usersTable.tableName,
      },
    });

    // Grant Lambda permissions to access DynamoDB
    usersTable.grantReadWriteData(authHandler);

    // API Gateway
    const api = new apigateway.RestApi(this, 'AuthApi', {
      restApiName: 'Authentication API',
      description: 'API for user authentication',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Lambda integration
    const authIntegration = new apigateway.LambdaIntegration(authHandler);

    // API routes
    const authResource = api.root.addResource('auth');
    authResource.addResource('register').addMethod('POST', authIntegration);
    authResource.addResource('login').addMethod('POST', authIntegration);

    // Output the API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'Authentication API URL'
    });
  }
}
