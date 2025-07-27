const vscode = require("vscode");
const cp = require("child_process");
const path = require("path");
const { getContractRootDir } = require("../helpers");

class GasDashboard {
    constructor() {
        this.testResults = new Map();
        this.totalTestCount = 0;
        this.failedTestCount = 0;
        this.succeededTestCount = 0;
        this.testSuites = [];
    }

    async runForgeTests(contractDir, testFilter = "", contractFilter = "") {
        return new Promise((resolve, reject) => {
            console.log("Running forge tests for gas analysis...");

            let forgeArgs = ["test", "--gas-report", "-vvvv", "--decode-internal"];

            if (testFilter) {
                forgeArgs.push(`--match-test=${testFilter}`);
            }
            if (contractFilter) {
                forgeArgs.push(`--match-contract=${contractFilter}`);
            }

            const forge = cp.spawn("forge", forgeArgs, { 
                cwd: contractDir,
                stdio: "pipe" 
            });

            let currentTest = null;
            let currentTrace = [];

            forge.stdout.on("data", (data) => {
                const lines = data.toString().split("\n");

                lines.forEach((line) => {
                    const testMatch = line.match(
                        /\[PASS\]\s+(\w+)\(\)\s+\(gas:\s+(\d+)\)/
                    );
                    if (testMatch) {
                        if (currentTest) {
                            this.processTestResult(currentTest, currentTrace);
                        }
                        currentTest = { name: testMatch[1], gas: parseInt(testMatch[2]) };
                        currentTrace = [];
                    }

                    // Parse test suite results
                    const suiteMatch = line.match(
                        /Ran (\d+) tests for (.+?)\s*$/
                    );
                    if (suiteMatch) {
                        const testCount = parseInt(suiteMatch[1]);
                        const suiteName = suiteMatch[2];
                        this.testSuites.push({ name: suiteName, testCount, passed: 0, failed: 0, time: '' });
                    }

                    // Parse suite result line
                    const suiteResultMatch = line.match(
                        /Suite result: (?:ok|FAILED)\. (\d+) passed; (\d+) failed; \d+ skipped; finished in ([\d.]+ms)/
                    );
                    if (suiteResultMatch && this.testSuites.length > 0) {
                        const lastSuite = this.testSuites[this.testSuites.length - 1];
                        lastSuite.passed = parseInt(suiteResultMatch[1]);
                        lastSuite.failed = parseInt(suiteResultMatch[2]);
                        lastSuite.time = suiteResultMatch[3];
                    }

                    // Parse the summary line
                    const summaryMatch = line.match(
                        /Encountered a total of (\d+) failing tests?, (\d+) tests? succeeded/
                    );
                    if (summaryMatch) {
                        this.failedTestCount = parseInt(summaryMatch[1]);
                        this.succeededTestCount = parseInt(summaryMatch[2]);
                        this.totalTestCount = this.failedTestCount + this.succeededTestCount;
                    }

                    if (line.includes("[") && line.includes("]") && line.includes("::")) {
                        currentTrace.push(line);
                    }
                });
            });

            forge.on("close", (code) => {
                if (currentTest) {
                    this.processTestResult(currentTest, currentTrace);
                }

                console.log(`Collected data for ${this.testResults.size} tests`);
                resolve();
            });

            forge.on("error", (err) => {
                reject(err);
            });
        });
    }

    processTestResult(test, traceLines) {
        const traces = [];
        let totalGas = 0;

        traceLines.forEach((line) => {
            const gasMatch = line.match(/\[(\d+)\]/);
            const funcMatch = line.match(/([^:\s]+)::([^(]+)/);

            if (gasMatch && funcMatch) {
                const gas = parseInt(gasMatch[1]);
                const contract = funcMatch[1];
                const func = funcMatch[2];
                const depth = (line.match(/[├│└]/g) || []).length;
                const isStaticCall = line.includes("[staticcall]");
                const isDelegateCall = line.includes("[delegatecall]");

                if (
                    !contract.startsWith("vm::") &&
                    !contract.startsWith("VM::") &&
                    !contract.startsWith("VM.") &&
                    !contract.startsWith("VM:") &&
                    !line.includes("vm.") &&
                    contract !== "VM"
                ) {
                    traces.push({
                        contract,
                        func,
                        gas,
                        depth,
                        type: isDelegateCall
                            ? "delegate"
                            : isStaticCall
                                ? "static"
                                : "call",
                        gasPercent: 0,
                    });
                    totalGas += gas;
                }
            }
        });

        traces.forEach((trace) => {
            trace.gasPercent = totalGas > 0 ? (trace.gas / totalGas) * 100 : 0;
        });

        this.testResults.set(test.name, {
            ...test,
            traces,
            totalGas,
            traceCount: traces.length,
            maxGas: traces.length > 0 ? Math.max(...traces.map((t) => t.gas)) : 0,
            contracts: [...new Set(traces.map((t) => t.contract))],
        });
    }

    generateDashboardHTML() {
        const tests = Array.from(this.testResults.values());
        const totalTests = this.totalTestCount > 0 ? this.totalTestCount : tests.length;
        const totalGas = tests.reduce((sum, t) => sum + t.gas, 0);
        const avgGas = totalTests > 0 ? Math.round(totalGas / totalTests) : 0;

        return `
<!DOCTYPE html>
<html>
<head>
    <title>Gas Analysis Dashboard</title>
    <meta charset="utf-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            font-size: 12px;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.3;
            padding: 16px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        
        .header {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 20px;
            margin-bottom: 16px;
        }
        
        .header h1 { 
            font-size: 20px; 
            color: var(--vscode-editor-foreground);
            margin-bottom: 4px;
        }
        .header p { 
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        .stats { 
            display: flex; 
            gap: 24px; 
            margin-top: 12px; 
        }
        .stat { text-align: left; }
        .stat-value { 
            font-size: 17px; 
            font-weight: 600; 
            color: var(--vscode-textLink-foreground);
        }
        .stat-label { 
            color: var(--vscode-descriptionForeground);
            font-size: 11px; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .controls {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 16px;
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .controls input, .controls select {
            padding: 6px 8px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
            font-size: 12px;
            color: var(--vscode-input-foreground);
            font-family: inherit;
        }
        .controls input:focus, .controls select:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }
        
        .grid { 
            display: grid; 
            grid-template-columns: 400px 1fr; 
            gap: 16px; 
        }
        
        .panel {
            background: var(--vscode-panel-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 16px;
        }
        .panel h3 { 
            margin-bottom: 12px; 
            color: var(--vscode-editor-foreground);
            font-size: 14px;
            font-weight: 500;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 6px;
        }
        
        .test-list { 
            max-height: 500px; 
            overflow-y: auto; 
        }
        
        .test-item {
            padding: 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 2px;
            margin-bottom: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: var(--vscode-list-inactiveSelectionBackground);
        }
        .test-item:hover { 
            border-color: var(--vscode-list-hoverBackground);
            background: var(--vscode-list-hoverBackground);
        }
        .test-item.selected { 
            border-color: var(--vscode-list-activeSelectionBackground);
            background: var(--vscode-list-activeSelectionBackground);
        }
        
        .test-name { 
            font-weight: 500; 
            font-size: 11px; 
            color: var(--vscode-editor-foreground);
            margin-bottom: 2px;
        }
        .test-gas { 
            color: var(--vscode-descriptionForeground);
            font-size: 11px; 
        }
        .gas-bar {
            height: 2px;
            border-radius: 1px;
            margin-top: 4px;
            background: var(--vscode-progressBar-background);
            opacity: 0.8;
        }
        
        .trace-viewer { 
            max-height: 500px; 
            overflow-y: auto;
        }
        
        .trace-summary {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 3px;
            padding: 10px;
            margin-bottom: 10px;
            font-size: 11px;
        }
        .trace-summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
        }
        .trace-summary-label { color: var(--vscode-descriptionForeground); }
        .trace-summary-value { color: var(--vscode-textLink-foreground); font-weight: 500; }
        
        .trace-item {
            position: relative;
            margin-bottom: 2px;
            transition: all 0.2s ease;
        }
        
        .trace-content {
            padding: 6px 12px;
            background: var(--vscode-editor-background);
            border-radius: 3px;
            font-size: 11px;
            border-left: 2px solid var(--vscode-panel-border);
            transition: all 0.2s ease;
            margin-left: var(--depth-margin);
        }
        .trace-content:hover {
            border-left-color: var(--vscode-textLink-foreground);
            background: var(--vscode-list-hoverBackground);
        }
        
        .trace-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 3px;
        }
        .trace-right {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .trace-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .trace-function { 
            font-weight: 500; 
            color: var(--vscode-editor-foreground);
            font-size: 11px;
        }
        .trace-gas { 
            color: var(--vscode-textLink-foreground);
            font-weight: 600;
            font-size: 11px;
        }
        .trace-details {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            display: flex;
            gap: 10px;
            margin-top: 2px;
        }
        .trace-gas-percent {
            color: var(--vscode-textLink-foreground);
            font-weight: 500;
        }
        
        .trace-type {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 2px;
            font-size: 8px;
            font-weight: 500;
            text-transform: uppercase;
            margin-right: 6px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
        }
        
        .loading {
            text-align: center;
            padding: 40px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
        
        .depth-0 { --depth-margin: 8px; }
        .depth-1 { --depth-margin: 20px; }
        .depth-2 { --depth-margin: 32px; }
        .depth-3 { --depth-margin: 44px; }
        .depth-4 { --depth-margin: 56px; }
        
        .suite-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 11px;
        }
        .suite-table th,
        .suite-table td {
            padding: 8px 12px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .suite-table th {
            background: var(--vscode-panel-background);
            color: var(--vscode-editor-foreground);
            font-weight: 500;
        }
        .suite-table td {
            background: var(--vscode-editor-background);
        }
        .suite-name {
            font-family: monospace;
            color: var(--vscode-textLink-foreground);
        }
        .suite-passed {
            color: #4CAF50;
            font-weight: 500;
        }
        .suite-failed {
            color: #f44336;
            font-weight: 500;
        }
        .suite-time {
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Gas Analysis Dashboard</h1>
            <p>Gas consumption analysis for Foundry tests</p>
            <div class="stats">
                <div class="stat">
                    <div class="stat-value">${totalTests}</div>
                    <div class="stat-label">tests</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${(totalGas / 1000000).toFixed(1)}M</div>
                    <div class="stat-label">total gas</div>
                </div>
                <div class="stat">
                    <div class="stat-value">${(avgGas / 1000).toFixed(1)}k</div>
                    <div class="stat-label">avg gas</div>
                </div>
            </div>
        </div>
        
        ${this.testSuites.length > 0 ? `
        <div class="panel">
            <h3>Test Suite Results</h3>
            <table class="suite-table">
                <thead>
                    <tr>
                        <th>Test File</th>
                        <th>Tests</th>
                        <th>Passed</th>
                        <th>Failed</th>
                        <th>Time</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.testSuites.map(suite => `
                        <tr>
                            <td class="suite-name">${suite.name}</td>
                            <td>${suite.testCount}</td>
                            <td class="suite-passed">${suite.passed}</td>
                            <td class="suite-failed">${suite.failed}</td>
                            <td class="suite-time">${suite.time}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        <div class="controls">
            <input type="text" id="searchTests" placeholder="Search tests..." />
            <select id="sortBy">
                <option value="gas">Sort by gas</option>
                <option value="name">Sort by name</option>
                <option value="traces">Sort by calls</option>
            </select>
            <select id="filterContract">
                <option value="">All contracts</option>
                ${[...new Set(tests.flatMap((t) => t.contracts))]
                .map((c) => `<option value="${c}">${c}</option>`)
                .join("")}
            </select>
        </div>
        
        <div class="grid">
            <div class="panel">
                <h3>Tests</h3>
                <div class="test-list" id="testList">
                    ${tests
                .map(
                    (test) => `
                        <div class="test-item" data-test="${test.name}">
                            <div class="test-name">${test.name}</div>
                            <div class="test-gas">
                                ${test.gas.toLocaleString()} gas • ${test.traceCount} calls
                            </div>
                            <div class="gas-bar" style="width: ${(test.gas /
                            Math.max(...tests.map((t) => t.gas))) *
                        100
                        }%"></div>
                        </div>
                    `
                )
                .join("")}
                </div>
            </div>
            
            <div class="panel">
                <h3>Trace Analysis</h3>
                <div class="trace-viewer" id="traceViewer">
                    <div class="loading">
                        Select a test to view execution trace
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const testData = ${JSON.stringify(tests)};
        let selectedTest = null;
        
        document.getElementById('searchTests').addEventListener('input', filterTests);
        document.getElementById('sortBy').addEventListener('change', sortTests);
        document.getElementById('filterContract').addEventListener('change', filterTests);
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.test-item')) {
                const testName = e.target.closest('.test-item').dataset.test;
                selectTest(testName);
            }
        });
        
        function selectTest(testName) {
            document.querySelectorAll('.test-item').forEach(item => {
                item.classList.remove('selected');
            });
            document.querySelector(\`[data-test="\${testName}"]\`).classList.add('selected');
            
            const test = testData.find(t => t.name === testName);
            showTraceAnalysis(test);
            selectedTest = test;
        }
        
        function formatGas(gas) {
            if (gas >= 1000000) return \`\${(gas/1000000).toFixed(1)}M\`;
            if (gas >= 1000) return \`\${(gas/1000).toFixed(1)}k\`;
            return gas.toString();
        }
        
        function showTraceAnalysis(test) {
            const container = document.getElementById('traceViewer');
            
            const sortedTraces = [...test.traces].sort((a, b) => b.gas - a.gas);
            
            container.innerHTML = \`
                <div class="trace-summary">
                    <div class="trace-summary-row">
                        <span class="trace-summary-label">Test:</span>
                        <span class="trace-summary-value">\${test.name}</span>
                    </div>
                    <div class="trace-summary-row">
                        <span class="trace-summary-label">Total Gas:</span>
                        <span class="trace-summary-value">\${test.gas.toLocaleString()}</span>
                    </div>
                    <div class="trace-summary-row">
                        <span class="trace-summary-label">Function Calls:</span>
                        <span class="trace-summary-value">\${test.traceCount}</span>
                    </div>
                    <div class="trace-summary-row">
                        <span class="trace-summary-label">Contracts:</span>
                        <span class="trace-summary-value">\${test.contracts.join(', ')}</span>
                    </div>
                </div>
                
                \${sortedTraces.map(trace => \`
                    <div class="trace-item depth-\${Math.min(trace.depth, 4)}">
                        <div class="trace-content">
                            <div class="trace-header">
                                <div class="trace-left">
                                    <span class="trace-type \${trace.type}">\${trace.type}</span>
                                    <span class="trace-function">\${trace.contract}::\${trace.func}</span>
                                </div>
                                <div class="trace-right">
                                    <span class="trace-gas">\${formatGas(trace.gas)}</span>
                                </div>
                            </div>
                            <div class="trace-details">
                                <span class="trace-gas-percent">\${trace.gasPercent.toFixed(1)}%</span>
                                <span class="trace-depth-info">depth \${trace.depth}</span>
                                <span class="trace-call-type">\${trace.type} call</span>
                            </div>
                        </div>
                    </div>
                \`).join('')}
            \`;
        }
        
        function filterTests() {
            const search = document.getElementById('searchTests').value.toLowerCase();
            const contract = document.getElementById('filterContract').value;
            
            document.querySelectorAll('.test-item').forEach(item => {
                const testName = item.dataset.test;
                const test = testData.find(t => t.name === testName);
                
                const matchesSearch = testName.toLowerCase().includes(search);
                const matchesContract = !contract || test.contracts.includes(contract);
                
                item.style.display = matchesSearch && matchesContract ? 'block' : 'none';
            });
        }
        
        function sortTests() {
            const sortBy = document.getElementById('sortBy').value;
            const container = document.getElementById('testList');
            const items = Array.from(container.querySelectorAll('.test-item'));
            
            items.sort((a, b) => {
                const testA = testData.find(t => t.name === a.dataset.test);
                const testB = testData.find(t => t.name === b.dataset.test);
                
                switch(sortBy) {
                    case 'gas': return testB.gas - testA.gas;
                    case 'name': return testA.name.localeCompare(testB.name);
                    case 'traces': return testB.traceCount - testA.traceCount;
                    default: return 0;
                }
            });
            
            items.forEach(item => container.appendChild(item));
        }
        
        if (testData.length > 0) {
            selectTest(testData[0].name);
        }
    </script>
</body>
</html>`;
    }
}

async function gasAnalysisActiveFile() {
    let activeDoc = vscode.window.activeTextEditor.document;
    let activeFile = activeDoc.fileName;

    if (!activeFile.endsWith(".t.sol")) {
        vscode.window.showErrorMessage("Gas analysis is only available for Foundry test files (.t.sol)");
        return;
    }

    const contractPathArray = activeFile.split("/");
    let contractName = contractPathArray[contractPathArray.length - 1];
    contractName = contractName.substring(0, contractName.length - 6); // Remove .t.sol
    contractPathArray.pop();

    let contractDir = await getContractRootDir(contractPathArray.join("/"));
    
    if (!contractDir || contractDir === "__null__") {
        vscode.window.showErrorMessage("Could not find foundry.toml. Make sure you're in a Foundry project.");
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating gas analysis...",
        cancellable: false
    }, async (progress) => {
        try {
            const dashboard = new GasDashboard();
            await dashboard.runForgeTests(contractDir, "", contractName);
            
            const panel = vscode.window.createWebviewPanel(
                'gasAnalysis',
                'Gas Analysis Dashboard',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = dashboard.generateDashboardHTML();
        } catch (error) {
            vscode.window.showErrorMessage(`Gas analysis failed: ${error.message}`);
        }
    });
}

async function gasAnalysisContextMenu(clickedFile, selectedFiles) {
    const testFiles = selectedFiles.filter(file => file.path.endsWith(".t.sol"));
    
    if (testFiles.length === 0) {
        vscode.window.showErrorMessage("No test files selected. Gas analysis is only available for .t.sol files.");
        return;
    }

    const contractDir = await getContractRootDir(path.dirname(testFiles[0].path));
    
    if (!contractDir || contractDir === "__null__") {
        vscode.window.showErrorMessage("Could not find foundry.toml. Make sure you're in a Foundry project.");
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating gas analysis...",
        cancellable: false
    }, async (progress) => {
        try {
            const dashboard = new GasDashboard();
            await dashboard.runForgeTests(contractDir);
            
            const panel = vscode.window.createWebviewPanel(
                'gasAnalysis',
                'Gas Analysis Dashboard',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = dashboard.generateDashboardHTML();
        } catch (error) {
            vscode.window.showErrorMessage(`Gas analysis failed: ${error.message}`);
        }
    });
}

async function gasAnalysisAllTests() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder found.");
        return;
    }

    const contractDir = await getContractRootDir(workspaceFolders[0].uri.fsPath);
    
    if (!contractDir || contractDir === "__null__") {
        vscode.window.showErrorMessage("Could not find foundry.toml. Make sure you're in a Foundry project.");
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Generating gas analysis for all tests...",
        cancellable: false
    }, async (progress) => {
        try {
            const dashboard = new GasDashboard();
            await dashboard.runForgeTests(contractDir);
            
            const panel = vscode.window.createWebviewPanel(
                'gasAnalysis',
                'Gas Analysis Dashboard - All Tests',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = dashboard.generateDashboardHTML();
        } catch (error) {
            vscode.window.showErrorMessage(`Gas analysis failed: ${error.message}`);
        }
    });
}

async function gasAnalysisSpecificTest(testName) {
    const activeDoc = vscode.window.activeTextEditor.document;
    const activeFile = activeDoc.fileName;
    const contractDir = await getContractRootDir(path.dirname(activeFile));
    
    if (!contractDir || contractDir === "__null__") {
        vscode.window.showErrorMessage("Could not find foundry.toml. Make sure you're in a Foundry project.");
        return;
    }

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Generating gas analysis for ${testName}...`,
        cancellable: false
    }, async (progress) => {
        try {
            const dashboard = new GasDashboard();
            await dashboard.runForgeTests(contractDir, testName);
            
            const panel = vscode.window.createWebviewPanel(
                'gasAnalysis',
                `Gas Analysis Dashboard - ${testName}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = dashboard.generateDashboardHTML();
        } catch (error) {
            vscode.window.showErrorMessage(`Gas analysis failed: ${error.message}`);
        }
    });
}

module.exports = { 
    gasAnalysisActiveFile, 
    gasAnalysisContextMenu, 
    gasAnalysisAllTests, 
    gasAnalysisSpecificTest 
};