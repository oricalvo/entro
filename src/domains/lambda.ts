import {checkViolation, SecretViolationOrigin, ViolationContext} from "../violation";
import {GetFunctionResponse} from "@aws-sdk/client-lambda/dist-types/models/models_0";
import path from "path";
import os from "os";
import fs_OLD from "fs";
import {readTextFile, unzipFile} from "../common/file.helpers";
import fs from "fs/promises";
import {walkLambdas} from "../common/aws.helpers";
import {promisify} from "util";
import {pipeline} from "stream";

const streamPipeline = promisify(pipeline);

export async function analyzeLambdas(context: ViolationContext): Promise<void> {
    console.log("Analyzing lambdas");

    let count = 0;
    await walkLambdas(async func => {
        ++count;
        console.log("Analyzing lambda", count);

        try {
            await analyzeLambda(context, func);
        } catch (err) {
            context.errors.push(err.message);
        }
    });
}

async function analyzeLambda(context: ViolationContext, func: GetFunctionResponse) {
    const {secrets, violations} = context;
    const funcName = func.Configuration?.FunctionName;

    checkViolation(
        JSON.stringify(func.Configuration),
        funcName + ".conf",
        SecretViolationOrigin.lambda,
        secrets,
        violations);

    if (!func.Code?.Location) {
        throw new Error("Lambda: " + func.Configuration.FunctionName + " has no location");
    }

    const response = await fetch(func.Code.Location);
    if (!response.ok) {
        throw new Error(`Failed to fetch Lambda code: ${response.statusText}`);
    }

    const zipFilePath = path.resolve(os.tmpdir(), "entro", funcName + ".zip");
    await streamPipeline(<any>response.body, fs_OLD.createWriteStream(zipFilePath));

    const outDirPath = path.resolve(os.tmpdir(), "entro", funcName);
    await unzipFile(zipFilePath, outDirPath);

    const files = await fs.readdir(outDirPath);
    if (!files.length) {
        throw new Error("No file was found for Lambda: " + func.Configuration.FunctionName);
    }

    for (const fileName of files) {
        const filePath = path.resolve(outDirPath, fileName);

        const code = await readTextFile(filePath);
        checkViolation(
            code,
            funcName + "/" + fileName,
            SecretViolationOrigin.lambda,
            secrets,
            violations);
    }
}
