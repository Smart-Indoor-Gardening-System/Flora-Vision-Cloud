import { DynamoDBClient  } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import { SQSHandler, SQSMessageAttributes } from 'aws-lambda';
const nodemailer = require("nodemailer");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: SQSHandler = async (event: any, context: any): Promise<any> => {
  try {
    console.log(event);

    for (const record of event.Records) {
      const messageAttributes: SQSMessageAttributes = record.messageAttributes;
      console.log('Message Attributtes -->  ', messageAttributes.AttributeNameHere.stringValue);
      console.log('Message Body -->  ', record.body);

      const body = JSON.parse(record.body);
      const { notificationPreference, email, action } = body;

      if (notificationPreference === 'mail') {
		let transporter = nodemailer.createTransport({
			service: "Gmail",
			host: "smtp.gmail.com",
			port: 465,
			secure: true, 
		  auth: {
			user: 'floravision2024@gmail.com', 
			pass: 'jcsk cree egxh ezzk', 
		  },
		});

		let info = await transporter.sendMail({
			from: 'floravision@gmail.com', 
			to: email,
			subject: action === "approved" ? "Your Device Add Request Approved  ✔ 🌱" : "Your Device Add Request Rejected 😢", 
			text: "Your Device Add Request Approved ✔",
			html: generateMailTemplate(action),
		  });
	  
	
		return {
			statusCode: 200,
			body: JSON.stringify(
			  {
				message: 'Mail sent successfully.',
				data: {
					input: event,
					messageId: info.messageId,
					previewURL: nodemailer.getTestMessageUrl(info)
				},
			  },
			  null,
			  2
			),
		  };
      }
    }
  } catch (error) {
    console.error('Error adding user`s device:', error);
    throw error;
  }
};


const generateMailTemplate = (action: string) => { 
	if(action ==="approved"){
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Indoor Garden System Notification</title>
		<style>
			body {
				font-family: Arial, sans-serif;
				background-color: #f0f0f0;
				margin: 0;
				padding: 0;
			}
			.container {
				max-width: 600px;
				margin: 20px auto;
				padding: 20px;
				background-color: #fff;
				border-radius: 10px;
				box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
			}
			.header {
				text-align: center;
				margin-bottom: 20px;
			}
			.header h1 {
				color: #4CAF50;
			}
			.content {
				text-align: center;
			}
			.button {
				display: inline-block;
				padding: 10px 20px;
				background-color: #4CAF50;
				color: #fff;
				text-decoration: none;
				border-radius: 5px;
				margin-top: 20px;
			}
		</style>
		</head>
		<body>
		<div class="container">
			<div class="header">
				<h1>Your Device Add Request Approved 🎉<span style="font-size: 24px;">✔</span></h1>
			</div>
			<div class="content">
				<p>Congratulations! Your request to add a new device has been approved. It's time to dive into the metrics and take your indoor gardening to the next level! 🌿✨</p>
				<p>Click the button below to view the metrics:</p>
				<a href="http://localhost:5173/Devices" class="button">View Metrics</a>
			</div>
		</div>
		</body>
		</html>
		`;
	}

	 if(action ==="rejected"){
		return `<!DOCTYPE html>
		<html lang="en">
		<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Indoor Garden System Notification</title>
		<style>
			body {
				font-family: Arial, sans-serif;
				background-color: #f0f0f0;
				margin: 0;
				padding: 0;
			}
			.container {
				max-width: 600px;
				margin: 20px auto;
				padding: 20px;
				background-color: #fff;
				border-radius: 10px;
				box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
			}
			.header {
				text-align: center;
				margin-bottom: 20px;
			}
			.header h1 {
				color: #ff6347;
			}
			.content {
				text-align: center;
			}
			.button {
				display: inline-block;
				padding: 10px 20px;
				background-color: #ff6347;
				color: #fff;
				text-decoration: none;
				border-radius: 5px;
				margin-top: 20px;
			}
		</style>
		</head>
		<body>
		<div class="container">
			<div class="header">
				<h1>Oops! Your Device Add Request Rejected 😢</h1>
			</div>
			<div class="content">
				<p>We're sorry, but your request to add a new device has been rejected this time. Don't worry, though! Let's work together to get everything sorted out.</p>
				<p>If you have any questions or need assistance, feel free to reach out to us.</p>
				<p>Keep growing! 🌱</p>
			</div>
		</div>

		</body>
		</html>`;

		return "Pending";
	
	}
};