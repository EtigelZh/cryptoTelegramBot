import type { Job } from "bull";

export type TransformMethodArguments<T> = {
    [P in keyof T]: T[P] extends (job: Job<infer U>) => Promise<unknown> ? (data: U) => Promise<Omit<Job, 'returnvalue' | 'finished'> & {
        returnvalue: ReturnType<T[P]>;
        finished(): Promise<ReturnType<T[P]>>;
    }> : never;
}