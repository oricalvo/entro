import {checkViolation, SecretViolationOrigin, ViolationContext} from "../violation";
import {walkCloudTrailEvents} from "../common/aws.helpers";

export async function analyzeCloudTrailEvents(context: ViolationContext): Promise<void> {
    console.log("Analyzing events");

    const {secrets, violations} = context;

    let count = 0;
    await walkCloudTrailEvents(async event => {
        ++count;
        console.log("Analyzing event", count);

        checkViolation(
            JSON.stringify(event),
            event.EventId,
            SecretViolationOrigin.event,
            secrets, violations);
    });
}
