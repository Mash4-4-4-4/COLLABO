const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const getToken = () => localStorage.getItem("codecast_token");
export async function api(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 401) {
            localStorage.removeItem("codecast_token");
            localStorage.removeItem("codecast_user");
        }
        throw new Error(payload.message || payload.error || "Request failed");
    }
    return payload;
}
export const apiUrl = API_URL;
