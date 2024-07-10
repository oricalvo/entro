import { Application, Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";

export type ExpressApplication = Application;

export interface ExpressRequest<RequestBodyT = any, ParamsT = any>
    extends Request<ParamsDictionary, any, RequestBodyT> {
    paramsTyped?: ParamsT;
}

export type ExpressResponse = Response;
export type ExpressHandler<RequestBodyT = any> = (
    req: ExpressRequest<RequestBodyT>,
    res: ExpressResponse,
    next: () => void
) => Promise<ExpressHandlerAction | void | object>;

export function promisifyExpressHandler<RequestBodyT = any>(func: ExpressHandler<RequestBodyT>) {
    return async function(this: any, req: ExpressRequest<RequestBodyT>, res: ExpressResponse, next) {
        try {
            const retVal = await func.call(this, req, res, next);

            if (retVal && retVal instanceof ExpressHandlerAction) {
                await retVal.execute(req, res, next);
            } else {
                if (req.query.hasOwnProperty("pretty")) {
                    res.send(JSON.stringify(retVal, undefined, 2));
                } else {
                    res.send(retVal);
                }
            }
        } catch (err) {
            next(err);
        }
    };
}

export abstract class ExpressHandlerAction {
    abstract execute(req, res, next);
}

export function errorHandler(err, req, res, next) {
    const payload: ErrorResponse = {
        ok: false,
        message: "Internal Server Error",
        errorCode: ErrorCode.internalServerError,
    };

    //
    //  Status code can be extracted from the err object
    //
    res.status(500).json(payload);
}

export enum ErrorCode {
    internalServerError = 1,
}

interface ErrorResponse {
    ok: false;

    //
    //  Friendly message, can be displayed to the user
    //
    message: string;

    errorCode: ErrorCode;

    //
    //  Non-friendly message, extracted from err.message is filled only under local env
    //
    errorMessage?: string;

    //
    //  Is filled only under local env
    //
    stack?: string;
}
