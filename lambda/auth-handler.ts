import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const USERS_TABLE = process.env.USERS_TABLE_NAME!;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path } = event;
  
  try {
    switch (`${httpMethod} ${path}`) {
      case 'POST /auth/register':
        return await handleRegister(event);
      case 'POST /auth/login':
        return await handleLogin(event);
      case 'GET /auth/profile':
        return await handleProfile(event);
      case 'POST /auth/refresh':
        return await handleRefresh(event);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Not Found' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal Server Error' })
    };
  }
};

function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { userId, email, type: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId, email, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function getAuthToken(event: APIGatewayProxyEvent): string | null {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

async function handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { email, password, name } = body;

  if (!email || !password) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Email and password are required' })
    };
  }

  // Check if user already exists
  const existingUser = await docClient.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email }
  }));

  if (existingUser.Items && existingUser.Items.length > 0) {
    return {
      statusCode: 409,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'User already exists' })
    };
  }

  // Hash password and create user
  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  const now = new Date().toISOString();

  await docClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      userId,
      email,
      password: hashedPassword,
      name: name || '',
      createdAt: now,
      updatedAt: now
    }
  }));

  const tokens = generateTokens(userId, email);

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'User created successfully',
      data: { userId, email, name },
      tokens
    })
  };
}

async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { email, password } = body;

  if (!email || !password) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Email and password are required' })
    };
  }

  // Find user by email
  const result = await docClient.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email }
  }));

  if (!result.Items || result.Items.length === 0) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Invalid credentials' })
    };
  }

  const user = result.Items[0];
  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Invalid credentials' })
    };
  }

  const tokens = generateTokens(user.userId, user.email);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'Login successful',
      data: { userId: user.userId, email: user.email, name: user.name },
      tokens
    })
  };
}

async function handleProfile(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const token = getAuthToken(event);
  if (!token) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Authorization token required' })
    };
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.type !== 'access') {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Invalid or expired token' })
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'Profile retrieved successfully',
      data: { userId: decoded.userId, email: decoded.email }
    })
  };
}

async function handleRefresh(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { refreshToken } = body;

  if (!refreshToken) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Refresh token required' })
    };
  }

  const decoded = verifyToken(refreshToken);
  if (!decoded || decoded.type !== 'refresh') {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Invalid refresh token' })
    };
  }

  const tokens = generateTokens(decoded.userId, decoded.email);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      message: 'Tokens refreshed successfully',
      tokens
    })
  };
}
