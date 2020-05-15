import dash from 'dash'
import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'

import { dashNetwork, faucetMnemonic, blockExplorerUrl, requestsTableName, corsHeaders } from "../index";
import { calculateIpSums } from "../utils";

export const faucetCallback = async (event: awsx.apigateway.Request): Promise<awsx.apigateway.Response> => {
  const ipAddress = event.requestContext.identity.sourceIp
  const dashAddress = event.queryStringParameters?.dashAddress;
  const tableName = requestsTableName.get()
  const date = new Date().toISOString();
  const amountToSendInDash = 50
  const rateLimit = 200 // allowed eDash per 10 minutes

  const request = { date, ipAddress, dashAddress }
  let response;

  const dbClient = new aws.sdk.DynamoDB.DocumentClient();
  const dashClient = new dash.Client({
    network: dashNetwork,
    mnemonic: faucetMnemonic
  });

  // check if request is good
  if (!dashAddress) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        request,
        response: {
          code: 3,
          message: 'Bad request. Please provide a dashAddress in query string',
          example: 'https://qetrgbsx30.execute-api.us-west-1.amazonaws.com/stage/?dashAddress=yiZhVxNJxgGwbvBS6DDze6gE7v6CrLQMWB'
        }
      }),
    };
  }

  // check rate limit
  let ipSums: any
  let requesterReceivedAmount
  await dbClient.scan({
    TableName: tableName,
  }).promise()
    .then(d => {
      requesterReceivedAmount = d
      ipSums = calculateIpSums(d.Items, 10)
    })
    .catch(e => console.log('In db scan: ', e));
  console.log(requesterReceivedAmount)
  if (ipSums[ipAddress] > rateLimit) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        request,
        response: {
          code: 2,
          message: 'Limit exceeded :(  Try again in 15 minutes'
        }
      }),
    };
  }


  // check faucet balance
  await dashClient.isReady().catch(() => console.log('In ready'));
  const { account } = dashClient;
  const unconfirmedBalance = account?.getUnconfirmedBalance()!
  const totalBalance = account?.getTotalBalance()!
  const lowBalance = (
    unconfirmedBalance / 100000000 < amountToSendInDash
    && totalBalance / 100000000 < amountToSendInDash
  );
  if (lowBalance) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        request,
        response: {
          code: 1,
          message: 'Funds not available (faucet needs a topup). Contact @Rion on Dash Discord)',
        }
      }),
    };
  }

  // send funds
  const sendFunds = async (address: string, satoshis: number) => {
    const transaction = account?.createTransaction({
      // @ts-ignore
      recipient: address,
      satoshis,
    });
    const _txid = await account?.broadcastTransaction(transaction)
      .catch((e: any) => console.log('In broadcast: ', e));
    return _txid
  }
  const txid = await sendFunds(dashAddress, amountToSendInDash * 100000000)
    .catch((e: any) => console.log('In sendFunds: ', e));

  response = {
    code: 0,
    message: 'Funds sent.',
    sentToAddress: dashAddress,
    amountSentInDash: amountToSendInDash,
    amountSentInSatoshis: amountToSendInDash * 10000000,
    transactionId: txid,
    transactionUrl: `${blockExplorerUrl}/tx/${txid}`,
  }

  await dbClient.put({
    TableName: tableName,
    Item: { id: date, request, response }
  }).promise().catch(e => console.log('In db put: ', e));;

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ request, response }),
  };
}