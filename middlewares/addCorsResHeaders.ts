import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';

const addCorsResHeaders = (handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>) =>
  async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    // Invoke the original Lambda handler
    const result = await handler(event, context);
    
    // Add the desired headers to the response
    const responseHeaders = {
      "Access-Control-Allow-Headers" : "Content-Type",
      "Access-Control-Allow-Origin": "http://localhost:5173",
      "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT"
    };
    
    return {
      ...result,
      headers: {
        ...result.headers,
        ...responseHeaders
      }
    };
  };


export default  addCorsResHeaders;
