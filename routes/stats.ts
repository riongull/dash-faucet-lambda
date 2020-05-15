import dash from 'dash'
import * as aws from '@pulumi/aws'
import * as awsx from '@pulumi/awsx'

import { dashNetwork, faucetMnemonic, requestsTableName, corsHeaders } from "../index";
import { calculateIpSums } from "../utils";

export const statsCallback = async (event: awsx.apigateway.Request): Promise<awsx.apigateway.Response> => {
  const ipAddress = event.requestContext.identity.sourceIp
  const tableName = requestsTableName.get()
  const date = new Date().toISOString();

  const dbClient = new aws.sdk.DynamoDB.DocumentClient();
  const dashClient = new dash.Client({
    network: dashNetwork,
    mnemonic: faucetMnemonic
  });
  const { account } = dashClient;
  await dashClient.isReady().catch(() => console.log('In ready'));
  const unconfirmedBalance = account?.getUnconfirmedBalance()
  const totalBalance = account?.getTotalBalance()
  const utxo = account?.getUTXOS();


  let count
  let tableData
  let ipSums
  await dbClient.scan({
    TableName: tableName,
  }).promise()
    .then(d => {
      tableData = d
      count = d.Count
      ipSums = calculateIpSums(tableData.Items, 10)
    })
    .catch(e => console.log('In db scan: ', e));;

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      faucetInfo: {
        requestCount: count,
        balance: {
          unconfirmed: unconfirmedBalance! / 100000000,
          total: totalBalance! / 100000000
        },
        // utxo,
      },
      ipSums,
      meta: {
        date,
        ipAddress,
      },
    }),
  };
}