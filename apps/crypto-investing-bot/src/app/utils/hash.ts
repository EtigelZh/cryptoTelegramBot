import { createHash } from 'crypto';

export function createMD5Hash(inputString: string): string {
    const hash = createHash('md5');
    hash.update(inputString);
    return hash.digest('hex');
}