import {SecretsManager} from "@aws-sdk/client-secrets-manager";
import PMap from "p-map";
import {pushMany} from "./array.helpers";
import {CloudTrail, Event} from "@aws-sdk/client-cloudtrail";
import {Lambda} from "@aws-sdk/client-lambda";
import {GetFunctionResponse} from "@aws-sdk/client-lambda/dist-types/models/models_0";
import {pipeline} from "stream";
import {promisify} from "util";
import pMap from "p-map";
import {readdirSync} from "node:fs";

export async function getAllSecrets(): Promise<string[]> {
    const all: string[] = [];

    const client = new SecretsManager();

    let nextToken: string = null;

    while (true) {
        const response = await client.listSecrets({
            MaxResults: 50,
            NextToken: nextToken,
        });

        const secrets = await PMap(response.SecretList, async s => {
            const secretString = (await client.getSecretValue({
                SecretId: s.ARN,
            })).SecretString;

            const objectWithOneKey = JSON.parse(secretString);
            const keys = Object.keys(objectWithOneKey);
            if (keys.length != 1) {
                throw new Error("Unexpected number of key for secretString");
            }

            const secret = objectWithOneKey[keys[0]];
            return secret;
        }, {concurrency: 10});

        pushMany(all, secrets);

        if (!response.NextToken) {
            break;
        }

        nextToken = response.NextToken;
    }

    return all;
}

export async function walkCloudTrailEvents(handler: (event: Event)=>Promise<void>, concurrency: number = 10): Promise<void> {
    const cloudTrailClient = new CloudTrail();

    let nextToken: string = null;
    let i = 0;

    while (true) {
        const response = await cloudTrailClient.lookupEvents({
            MaxResults: 50,
            NextToken: nextToken
        });

        await pMap(response.Events, async event => {
            await handler(event);
        }, {concurrency});

        if (!response.NextToken) {
            break;
        }

        nextToken = response.NextToken;
    }
}

export async function getCloudTrailEvents(max?: number): Promise<Event[]> {
    const events: Event[] = [];
    const cloudTrailClient = new CloudTrail();

    let nextToken: string = null;
    let i = 0;

    while (true) {
        const response = await cloudTrailClient.lookupEvents({
            MaxResults: 50,
            NextToken: nextToken
        });

        pushMany(events, response.Events);

        if (max && events.length >= max) {
            break;
        }

        if (!response.NextToken) {
            break;
        }

        nextToken = response.NextToken;
    }

    if (max) {
        return events.slice(0, max);
    }

    return events;
}

export async function walkLambdas(handler: (conf: GetFunctionResponse) => Promise<void>, concurrency: number = 10): Promise<void> {
    const client = new Lambda();

    let marker: string = null;
    let i = 0;

    while (true) {
        const response = await client.listFunctions({
            MaxItems: 50,
            Marker: marker,
        });

        await PMap(response.Functions, async funcConf => {
            const func = await client.getFunction({
                FunctionName: funcConf.FunctionName,
            });

            await handler(func);
        }, {concurrency});

        if (!response.NextMarker) {
            break;
        }

        marker = response.NextMarker;
    }
}
