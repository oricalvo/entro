import {deleteSecretByARN, getAllSecrets} from "./common/aws.helpers";
import {SecretViolation, ViolationContext} from "./violation";
import {analyzeLambdas} from "./domains/lambda";
import {analyzeCloudTrailEvents} from "./domains/cloudTrail";
import {errorHandler, ExpressApplication, ExpressRequest, promisifyExpressHandler} from "./common/express.helpers";
import express from "express";
import bodyParser from "body-parser";
import {waitForEvent} from "./common/promise.helpers";
import { rateLimit } from 'express-rate-limit';

async function main() {
    const app = express();

    await configureMiddlewares(app);

    const port = 1234;

    const server = app.listen(port, async () => {
        console.log("NODE_ENV: " + app.settings.env);
        console.log("Server is listening on port: " + port);
    });

    await waitForEvent(server, "close");
}

async function getCloudTrailSecrets(): Promise<AnalyzeViolationResponse> {
    return await getAllViolations(false, true);
}

async function getExposedSecrets(): Promise<AnalyzeViolationResponse> {
    return await getAllViolations(true, false);
}

async function getAllViolations(lambda: boolean, cloudTrail: boolean): Promise<AnalyzeViolationResponse> {
    const secrets = await getAllSecrets();

    const context: ViolationContext = {
        errors: [],
        violations: [],
        secrets,
    };

    if(lambda) {
        await analyzeLambdas(context);
    }

    if(cloudTrail) {
        await analyzeCloudTrailEvents(context);
    }

    return {
        violations: context.violations,
        errors: context.errors
    };
}

async function deleteSecret(req: ExpressRequest) {
    const body: DeleteSecretRequest = req.body;

    if(!body.arn) {
        throw new Error("Secret ARN is missing");
    }

    await deleteSecretByARN(body.arn);
}

async function configureMiddlewares(app: ExpressApplication) {
    app.use(bodyParser.json({
        limit: "40mb",
    }));

    app.use(bodyParser.urlencoded({ extended: true }));

    app.use(rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 100,
    }));

    app.get("/getcloudtrailsecrets", promisifyExpressHandler(getCloudTrailSecrets));
    app.get("/getexposedsecrets", promisifyExpressHandler(getExposedSecrets));
    app.post("/deletesecret", promisifyExpressHandler(deleteSecret));

    app.use(errorHandler);
}

interface AnalyzeViolationResponse {
    violations: SecretViolation[];
    errors: string[];
}

interface DeleteSecretRequest {
    arn: string;
}

main();
