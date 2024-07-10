
export interface SecretViolation {
    origin: SecretViolationOrigin;
    id: string;
    secret: string;
}

export enum SecretViolationOrigin {
    lambda = "lambda",
    event = "event",
}

export interface ViolationContext {
    secrets: string[];
    violations: SecretViolation[];
    errors: string[];
}

export function checkViolation(str: string,
                        id: string,
                        origin: SecretViolationOrigin,
                        secrets: string[],
                        violations: SecretViolation[]) {
    for(const secret of secrets) {
        const index = str.indexOf(secret);
        if (index != -1) {
            violations.push({
                origin,
                id,
                secret,
            });
        }
    }
}
