import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path } = event;
  
  try {
    switch (`${httpMethod} ${path}`) {
      case 'POST /auth/register':
        return await handleRegister(event);
      case 'POST /auth/login':
        return await handleLogin(event);
      default:
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'Not Found' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' })
    };
  }
};

async function handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'User registration endpoint',
      data: { email: body.email }
    })
  };
}

async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'User login endpoint',
      data: { email: body.email }
    })
  };
}
