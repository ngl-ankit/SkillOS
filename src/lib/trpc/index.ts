import { makeTrpcClient } from './client';

/** Shared browser-side tRPC client. Identity always comes from the session cookie. */
export const api = makeTrpcClient();
