export function pushMany<T>(target: T[], source: T[]) {
    for (const val of source) {
        target.push(val);
    }
}
