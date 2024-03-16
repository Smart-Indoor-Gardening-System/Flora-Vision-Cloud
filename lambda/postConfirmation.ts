import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";

import { DEFAULT_DASHBOARD_CUSTOMIZATION } from "../types/dashboard-customization";
import { DEFAULT_NOTIFICATION_PREFERENCE } from "../types/notification-preference";
import { DEFAULT_METRIC_PREFERENCE } from "../types/metric-preference";

const dynamoDBClient = new DynamoDBClient({});

export const handler = async (event:any) => {
 console.log(event.request.userAttributes)
  const userId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;
  

  const params = {
    TableName:  process.env.TABLE_NAME,
    Item: {
	  userId,
      email: email,
	  dashboardCustomization: DEFAULT_DASHBOARD_CUSTOMIZATION,
	  notificationPreference: DEFAULT_NOTIFICATION_PREFERENCE,
	  metricPreference: DEFAULT_METRIC_PREFERENCE,
	  isNameVisible: true
    }
  };

  try {
    await dynamoDBClient.send(new PutCommand(params));
    console.log(`User ${userId} added to table ${ process.env.TABLE_NAME}`);
  } catch (error) {
    console.error(`Error adding user ${userId} to table ${ process.env.TABLE_NAME}:`, error);
    throw new Error(`Error adding user to table: ${error}`);
  }

  return event;
};