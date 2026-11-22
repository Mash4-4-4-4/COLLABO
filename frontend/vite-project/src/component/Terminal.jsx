
import "./Terminal.css";

function Terminal({ output, error, isRunning, executionTime, exitCode }) {
    return (
        <div className="terminal-container">

            <div className="terminal-header">
                <span>TERMINAL</span>

                <span className="terminal-status">
                    {isRunning ? "RUNNING..." : "READY"}
                </span>
            </div>

            <div className="terminal-body">
                {isRunning && (
                    <p className="terminal-running">
                        Executing Java program...
                    </p>
                )}

                {output && (
                    <pre className="terminal-output">{output}</pre>
                )}

                {error && (
                    <pre className="terminal-error">{error}</pre>
                )}

                {!isRunning && !output && !error && (
                    <p className="terminal-placeholder">
                        Click RUN to execute your Java program.
                    </p>
                )}

                {!isRunning && exitCode !== null && (
                    <div className="terminal-footer">
                        Exit code: {exitCode}
                        {executionTime !== null && (
                            <span> | Time: {executionTime} ms</span>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
}

export default Terminal;
