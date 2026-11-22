
import { spawn } from "node:child_process";//Starts Docker as an external process
import { mkdtemp, writeFile, rm } from "node:fs/promises";//Creates a unique temporary folder Writes Java code into a file
import { tmpdir } from "node:os";//Gets the operating system's temporary directory
import path from "node:path";
import { randomUUID } from "node:crypto";

const EXECUTION_TIMEOUT = 10000;
const MAX_OUTPUT_BYTES = 64 * 1024;
const runDocker = (args, input = "", containerName) => {
    return new Promise((resolve, reject) => {
        const child = spawn("docker", args, {
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true
        });

let stdout = "";
let stderr = "";
let timedOut = false;
let outputLimitExceeded = false;
let outputBytes = 0;
const collectOutput = (currentOutput, data) => {
    if (outputLimitExceeded) {
        return currentOutput;
    }

    const buffer = Buffer.from(data);
    const remainingBytes = MAX_OUTPUT_BYTES - outputBytes;

    if (buffer.length > remainingBytes) {
        outputLimitExceeded = true;

        const killer = spawn("docker", ["kill", containerName], {
            stdio: "ignore",
            windowsHide: true
        });

        killer.on("error", (error) => {
            console.error("Failed to stop Docker container:", error);
        });

        outputBytes = MAX_OUTPUT_BYTES;

        return currentOutput + buffer.subarray(0, remainingBytes).toString("utf8");
    }

    outputBytes += buffer.length;

    return currentOutput + buffer.toString("utf8");
};

    





   const timer = setTimeout(() => {
    timedOut = true;

    const killer = spawn("docker", ["kill", containerName], {
        stdio: "ignore",
        windowsHide: true
    });

    killer.on("error", (error) => {
        console.error("Failed to stop Docker container:", error);
    });
}, EXECUTION_TIMEOUT);

        child.stdout.on("data", (data) => {
    stdout = collectOutput(stdout, data);
});

child.stderr.on("data", (data) => {
    stderr = collectOutput(stderr, data);
});

        child.on("error", (error) => {
            clearTimeout(timer);
            reject(error);
        });

        child.on("close", (exitCode) => {
            clearTimeout(timer);

           resolve({
    stdout,
    stderr,
    exitCode,
    timedOut,
    outputLimitExceeded
});
        });

        child.stdin.end(input);
    });
};

export const executeJavaCode = async (code, input = "") => {
    const workspace = await mkdtemp(
        path.join(tmpdir(), "codecast-java-")
    );

    try {
        const sourcePath = path.join(workspace, "Main.java");

        await writeFile(sourcePath, code, "utf8");

        const containerName = `codecast-${randomUUID()}`;

        const dockerArgs = [
            "run",
            "-i",
            "--rm",
            "--name", containerName,
            "--network", "none",
            "--memory", "256m",
            "--cpus", "0.5",
            "--pids-limit", "64",
            "--user", "10001:10001",
            "--read-only",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
            "-v", `${workspace}:/app:rw`,
            "-w", "/app",
            "eclipse-temurin:21-jdk",
            "sh", "-c",
            "javac Main.java && java Main" //these are docker instructions
        ];

        const startTime = Date.now();//measuring execution time

const result = await runDocker(dockerArgs, input, containerName);
        return {
            output: result.stdout,
           error: result.timedOut
    ? "Execution timed out"
    : result.outputLimitExceeded
        ? "Output limit exceeded (64 KB)"
        : result.stderr || null,
            exitCode: result.exitCode,
            executionTime: Date.now() - startTime
        };

    } finally {
        await rm(workspace, { //deleting temp files of java
            recursive: true,
            force: true
        });
    }
};
