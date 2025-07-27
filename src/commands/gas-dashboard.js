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
                forgeArgs.push(`--match-path=${contractFilter}`);
            }
            console.log(`Forge command: forge ${forgeArgs.join(" ")}`);
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
                console.error("Error running forge tests:", err);
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

    calculateGasStatistics(gasValues) {
        if (gasValues.length === 0) return null;
        
        const sorted = [...gasValues].sort((a, b) => a - b);
        const mean = gasValues.reduce((sum, val) => sum + val, 0) / gasValues.length;
        const variance = gasValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / gasValues.length;
        const stdDev = Math.sqrt(variance);
        
        const q1Index = Math.floor(sorted.length * 0.25);
        const q3Index = Math.floor(sorted.length * 0.75);
        const medianIndex = Math.floor(sorted.length * 0.5);
        
        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            mean: Math.round(mean),
            median: sorted[medianIndex],
            q1: sorted[q1Index],
            q3: sorted[q3Index],
            stdDev: Math.round(stdDev),
            iqr: sorted[q3Index] - sorted[q1Index]
        };
    }

    generateDashboardHTML() {
        const tests = Array.from(this.testResults.values());
        const totalTests = this.totalTestCount > 0 ? this.totalTestCount : tests.length;
        const totalGas = tests.reduce((sum, t) => sum + t.gas, 0);
        const avgGas = totalTests > 0 ? Math.round(totalGas / totalTests) : 0;

        // Calculate gas statistics
        const gasValues = tests.map(t => t.gas).sort((a, b) => a - b);
        const gasStats = this.calculateGasStatistics(gasValues);
        const gasOutliers = tests.filter(t => t.gas > gasStats.mean + 2 * gasStats.stdDev);

        return `
<!DOCTYPE html>
<html>
<head>
    <title>Gas Analysis Dashboard</title>
    <meta charset="utf-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Geist Mono', Tahoma, Geneva, Verdana, sans-serif; 
            font-size: 12px;
            background: #000000ff;
            color: #ccc;
            line-height: 1.3;
            padding: 16px;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        
        .header {
            background: linear-gradient(135deg, #0a0a0a 0%, #1a0a00 100%);
            border: 1px solid #331100;
            border-radius: 4px;
            padding: 20px;
            margin-bottom: 16px;
            position: relative;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 1px;
            background: linear-gradient(90deg, #ff6600, #ff9900, #ffcc00);
            opacity: 0.6;
        }
        
        .header h1 { 
            font-size: 20px; 
            color: #ff8800;
            margin-bottom: 4px;
            font-weight: 500;
        }
        .header p { 
            color: #666;
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
            color: #ff9900;
        }
        .stat-label { 
            color: #666;
            font-size: 11px; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .controls {
            background: #0a0a0a;
            border: 1px solid #222;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 16px;
            display: flex;
            gap: 12px;
            align-items: center;
        }
        .controls input, .controls select {
            padding: 6px 8px;
            background: #111;
            border: 1px solid #333;
            border-radius: 2px;
            font-size: 12px;
            color: #ccc;
            font-family: inherit;
            font-weight: 300;
        }
        .controls input:focus, .controls select:focus {
            outline: none;
            border-color: #ff6600;
        }
        
        .grid { 
            display: grid; 
            grid-template-columns: 400px 1fr; 
            gap: 16px; 
        }
        
        .panel {
            background: #0a0a0a;
            border: 1px solid #222;
            border-radius: 4px;
            padding: 16px;
        }
        .panel h3 { 
            margin-bottom: 12px; 
            color: #ff8800;
            font-size: 14px;
            font-weight: 500;
            border-bottom: 1px solid #222;
            padding-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .panel h3::before {
            content: '';
            width: 4px;
            height: 16px;
            background: linear-gradient(180deg, #ff6600, #ff9900);
            border-radius: 2px;
        }
        
        .test-list { 
            max-height: 500px; 
            overflow-y: auto; 
            scrollbar-width: thin;
            scrollbar-color: #333 #111;
        }
        .test-list::-webkit-scrollbar { width: 4px; }
        .test-list::-webkit-scrollbar-track { background: #111; }
        .test-list::-webkit-scrollbar-thumb { 
            background: #333; 
            border-radius: 2px; 
        }
        
        .test-item {
            padding: 8px;
            border: 1px solid #222;
            border-radius: 2px;
            margin-bottom: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            background: #111;
        }
        .test-item:hover { 
            border-color: #ff6600; 
            background: #1a1100;
        }
        .test-item.selected { 
            border-color: #ff8800; 
            background: #1a1100;
        }
        
        .test-name { 
            font-weight: 500; 
            font-size: 11px; 
            color: #eee;
            margin-bottom: 2px;
        }
        .test-gas { 
            color: #777;
            font-size: 11px; 
        }
        .gas-bar {
            height: 2px;
            border-radius: 1px;
            margin-top: 4px;
            background: linear-gradient(90deg, #ff6600 0%, #ff9900 50%, #ffcc00 100%);
            opacity: 0.8;
        }
        
        .trace-viewer { 
            max-height: 500px; 
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #333 #111;
        }
        .trace-viewer::-webkit-scrollbar { width: 4px; }
        .trace-viewer::-webkit-scrollbar-track { background: #111; }
        .trace-viewer::-webkit-scrollbar-thumb { 
            background: #333; 
            border-radius: 2px; 
        }
        
        .trace-summary {
            background: #111;
            border: 1px solid #333;
            border-radius: 3px;
            padding: 10px;
            margin-bottom: 10px;
            font-size: 12px;
        }
        .trace-summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
        }
        .trace-summary-label { color: #777; }
        .trace-summary-value { color: #ff9900; font-weight: 500; }
        
        .trace-item {
            position: relative;
            margin-bottom: 2px;
            transition: all 0.2s ease;
        }
        
        .trace-content {
            padding: 6px 12px;
            background: #111;
            border-radius: 3px;
            font-size: 12px;
            border-left: 2px solid #333;
            transition: all 0.2s ease;
            margin-left: var(--depth-margin);
        }
        .trace-content:hover {
            border-left-color: #ff6600;
            background: #1a1100;
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
            color: #eee;
            font-size: 11px;
        }
        .trace-gas { 
            color: #ff9900;
            font-weight: 600;
            font-size: 11px;
        }
        .trace-details {
            color: #777;
            font-size: 11px;
            display: flex;
            gap: 10px;
            margin-top: 2px;
        }
        .trace-gas-percent {
            color: #ff9900;
            font-weight: 500;
        }
        
        .trace-type {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 2px;
            font-size: 8.5px;
            font-weight: 500;
            text-transform: uppercase;
            margin-right: 6px;
        }
        .trace-type.call { background: #333; color: #ccc; }
        .trace-type.static { background: #002233; color: #0099cc; }
        .trace-type.delegate { background: #331100; color: #ff9900; }
        
        .loading {
            text-align: center;
            padding: 40px;
            font-size: 11px;
            color: #666;
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
            border-bottom: 1px solid #222;
        }
        .suite-table th {
            background: #0a0a0a;
            color: #ff8800;
            font-weight: 500;
        }
        .suite-table td {
            background: #111;
        }
        .suite-name {
            font-family: monospace;
            color: #ff9900;
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
            color: #777;
        }
        
        .gas-stats-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 12px;
            margin-bottom: 16px;
        }
        .stat-box {
            background: #111;
            border: 1px solid #333;
            border-radius: 3px;
            padding: 10px;
            text-align: center;
        }
        .stat-box-value {
            font-size: 14px;
            font-weight: 600;
            color: #ff9900;
            margin-bottom: 4px;
        }
        .stat-box-label {
            color: #777;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .gas-histogram {
            height: 120px;
            background: #111;
            border: 1px solid #333;
            border-radius: 3px;
            margin-bottom: 16px;
            position: relative;
            padding: 8px;
            display: flex;
            align-items: end;
            gap: 2px;
        }
        .histogram-bar {
            background: linear-gradient(180deg, #ff6600, #ff9900);
            border-radius: 2px 2px 0 0;
            opacity: 0.8;
            transition: opacity 0.2s ease;
            min-width: 4px;
            position: relative;
        }
        .histogram-bar:hover {
            opacity: 1;
        }
        .histogram-bar::after {
            content: attr(data-count);
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 9px;
            color: #ff9900;
            opacity: 0;
            transition: opacity 0.2s ease;
        }
        .histogram-bar:hover::after {
            opacity: 1;
        }
        
        .outliers-section {
            border-top: 1px solid #333;
            padding-top: 12px;
        }
        .outliers-section h4 {
            color: #ff8800;
            font-size: 12px;
            margin-bottom: 8px;
            font-weight: 500;
        }
        .outliers-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .outlier-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 8px;
            background: #1a0500;
            border: 1px solid #441100;
            border-radius: 2px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .outlier-item:hover {
            border-color: #ff6600;
            background: #2a0800;
        }
        .outlier-name {
            font-size: 10px;
            color: #eee;
        }
        .outlier-gas {
            font-size: 10px;
            color: #ff6600;
            font-weight: 600;
        }
        .outlier-duration {
            font-size: 10px;
            color: #ff6600;
            font-weight: 600;
        }
        
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Foundry Gas Analysis Dashboard</h1>
            <p>Auto Generated by VSCode Solidity Inspector</p>
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
        
        ${gasStats ? `
        <div class="panel">
            <h3>Gas Usage Distribution</h3>
            <div class="gas-stats-grid">
                <div class="stat-box">
                    <div class="stat-box-value">${(gasStats.min / 1000).toFixed(1)}k</div>
                    <div class="stat-box-label">min</div>
                </div>
                <div class="stat-box">
                    <div class="stat-box-value">${(gasStats.q1 / 1000).toFixed(1)}k</div>
                    <div class="stat-box-label">q1</div>
                </div>
                <div class="stat-box">
                    <div class="stat-box-value">${(gasStats.median / 1000).toFixed(1)}k</div>
                    <div class="stat-box-label">median</div>
                </div>
                <div class="stat-box">
                    <div class="stat-box-value">${(gasStats.q3 / 1000).toFixed(1)}k</div>
                    <div class="stat-box-label">q3</div>
                </div>
                <div class="stat-box">
                    <div class="stat-box-value">${(gasStats.max / 1000).toFixed(1)}k</div>
                    <div class="stat-box-label">max</div>
                </div>
                <div class="stat-box">
                    <div class="stat-box-value">±${(gasStats.stdDev / 1000).toFixed(1)}k</div>
                    <div class="stat-box-label">std dev</div>
                </div>
            </div>
            
            <div class="gas-histogram" id="gasHistogram"></div>
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
        const gasStats = ${JSON.stringify(gasStats)};
        const gasValues = ${JSON.stringify(gasValues)};
        let selectedTest = null;
        
        document.getElementById('searchTests').addEventListener('input', filterTests);
        document.getElementById('sortBy').addEventListener('change', sortTests);
        document.getElementById('filterContract').addEventListener('change', filterTests);
        
        document.addEventListener('click', (e) => {
            if (e.target.closest('.test-item')) {
                const testName = e.target.closest('.test-item').dataset.test;
                selectTest(testName);
            }
            if (e.target.closest('.outlier-item')) {
                const testName = e.target.closest('.outlier-item').dataset.test;
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
        
        function generateHistogram() {
            const container = document.getElementById('gasHistogram');
            if (!container || !gasValues || gasValues.length === 0) return;
            
            const numBins = Math.min(20, Math.max(5, Math.ceil(Math.sqrt(gasValues.length))));
            const min = Math.min(...gasValues);
            const max = Math.max(...gasValues);
            const binSize = (max - min) / numBins;
            
            const bins = Array(numBins).fill(0);
            gasValues.forEach(gas => {
                const binIndex = Math.min(numBins - 1, Math.floor((gas - min) / binSize));
                bins[binIndex]++;
            });
            
            const maxCount = Math.max(...bins);
            container.innerHTML = bins.map((count, i) => {
                const height = count === 0 ? 2 : Math.max(8, (count / maxCount) * 100);
                const startGas = min + (i * binSize);
                const endGas = min + ((i + 1) * binSize);
                return \`<div class="histogram-bar" 
                            style="height: \${height}px; flex: 1;" 
                            data-count="\${count}"
                            title="\${count} tests: \${(startGas/1000).toFixed(1)}k - \${(endGas/1000).toFixed(1)}k gas">
                        </div>\`;
            }).join('');
        }
        
        if (testData.length > 0) {
            selectTest(testData[0].name);
            generateHistogram();
        }
    </script>
</body>
</html>`;
    }
}

async function gasAnalysisActiveFile() {
    let activeDoc = vscode.window.activeTextEditor.document;
    let activeFile = activeDoc.fileName;

    if (!activeFile.endsWith(".t.sol") && !activeFile.endsWith("Test.sol")) {
        vscode.window.showErrorMessage("Gas analysis is only available for Foundry test files (.t.sol)");
        return;
    }
    console.log("Active file for gas analysis:", activeFile);
    const contractPathArray = activeFile.split("/");
    let contractName = contractPathArray[contractPathArray.length - 1];
    if (contractName.endsWith(".t.sol")) {
        contractName = contractName.substring(0, contractName.length - 6); // Remove .t.sol
    } else if (contractName.endsWith("Test.sol")) {
        contractName = contractName.substring(0, contractName.length - 4); // Remove .sol
    }
    contractPathArray.pop();

    let contractDir = await getContractRootDir(contractPathArray.join("/"));
    console.log("Contract path array:", contractPathArray);
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
            await dashboard.runForgeTests(contractDir, "", activeFile);
            
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
    const testFiles = selectedFiles.filter(file => file.path.endsWith(".t.sol") || file.path.endsWith("Test.sol"));
    
    if (testFiles.length === 0) {
        vscode.window.showErrorMessage("No test files selected. Gas analysis is only available for .t.sol and Test.sol files.");
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