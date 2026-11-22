import { executeJavaCode } from "../services/javaExecutionService.js";

const MAX_CODE_SIZE = 50 * 1024;
const MAX_INPUT_SIZE = 10 * 1024;

export const executeJava = async (req, res) => {
    try {
        const { code, input = "" } = req.body;

        if (typeof code !== "string" || !code.trim()) {
            return res.status(400).json({
                success: false,
                error: "Java source code is required"
            });
        }

        if (Buffer.byteLength(code, "utf8") > MAX_CODE_SIZE) {
            return res.status(413).json({
                success: false,
                error: "Java source code exceeds the 50 KB limit"
            });
        }

        if (typeof input !== "string") {
            return res.status(400).json({
                success: false,
                error: "Input must be a string"
            });
        }

        if (Buffer.byteLength(input, "utf8") > MAX_INPUT_SIZE) {
            return res.status(413).json({
                success: false,
                error: "Input exceeds the 10 KB limit"
            });
        }

        const result = await executeJavaCode(code, input);

        return res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error("Java execution error:", error);

        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
};