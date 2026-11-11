
import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

export const initSocket = () => {
    const socket = io(SOCKET_URL, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        timeout: 10000,
    });

    return socket;
};
