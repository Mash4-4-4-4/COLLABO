import { io } from "socket.io-client";
import { getToken, apiUrl } from "./utils/api";

export const initSocket = () => io(apiUrl, {
    autoConnect: false,
    auth: { token: getToken() },
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 10000,
});
