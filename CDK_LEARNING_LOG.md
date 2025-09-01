# CDK Learning Progress

## Completed Steps

### 1. CDK Fundamentals ✅
- **App**: Root construct containing stacks
- **Stack**: Deployment unit (maps to CloudFormation)
- **Construct**: Building blocks for AWS resources
- **Props**: Configuration objects

### 2. DynamoDB Table ✅
```typescript
const usersTable = new dynamodb.Table(this, 'UsersTable', {
  tableName: 'auth-users',
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
});
```

**Key Learnings:**
- CDK generates unique resource names automatically
- `removalPolicy: DESTROY` for development environments
- Global Secondary Index for alternative query patterns

### 3. Lambda Function ✅
```typescript
const authHandler = new nodejs.NodejsFunction(this, 'AuthHandler', {
  entry: 'lambda/auth-handler.ts',
  runtime: lambda.Runtime.NODEJS_18_X,
  environment: { USERS_TABLE_NAME: usersTable.tableName },
});
```

**Key Learnings:**
- `NodejsFunction` automatically bundles TypeScript
- Environment variables for configuration
- `grantReadWriteData()` for IAM permissions

## Next Steps
1. Add API Gateway
2. Add Cognito User Pool
3. Connect Lambda to API Gateway
4. Implement actual DynamoDB operations
5. Add Google OAuth integration

## CDK Commands Used
- `npm run build` - Compile TypeScript
- `npx cdk synth` - Generate CloudFormation template
- `npx cdk deploy` - Deploy to AWS (not used yet)
- `npx cdk diff` - Compare with deployed stack
