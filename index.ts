import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as pulumi from '@pulumi/pulumi';
import { faucetCallback, statsCallback } from './routes';

const config = new pulumi.Config();

export const dashNetwork = config.get('dashNetwork');
export const faucetMnemonic = config.get("faucetMnemonic");
export const blockExplorerUrl = config.get("blockExplorerUrl");
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
}

const faucetHandler = new aws.lambda.CallbackFunction("faucet-handler", {
  runtime: "nodejs10.x",
  memorySize: 256,
  callback: faucetCallback,
});

const statsHandler = new aws.lambda.CallbackFunction("stats-handler", {
  runtime: "nodejs10.x",
  memorySize: 256,
  callback: statsCallback,
});

const faucetApi = new awsx.apigateway.API("faucet-api", {
  routes: [
    {
      path: "/",
      method: "OPTIONS",
      eventHandler: async () => ({
        statusCode: 200,
        headers: corsHeaders,
        body: 'All good'
      })
    },
    {
      path: "/",
      method: "GET",
      eventHandler: faucetHandler,
    },
    {
      path: "/stats",
      method: "GET",
      eventHandler: statsHandler,
    },
  ],
});

const requestsTable = new aws.dynamodb.Table("requests-table", {
  hashKey: "id",
  billingMode: "PAY_PER_REQUEST",
  attributes: [
    { name: "id", type: "S" },
  ],
});

export const url = faucetApi.url;
export const apiId = faucetApi.deployment.id;
export const restApi = faucetApi.deployment.restApi;
export const requestsTableName = requestsTable.name;
