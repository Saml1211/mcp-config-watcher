import { spawn } from 'child_process';
import fs from 'fs-extra';

// Command line arguments
const args = process.argv.slice(2);
const command = args[0];
const commandArgs = args.slice(1);

if (!command) {
  console.error('Usage: node test-raw-output.js <command> [args...]');
  console.error('Example: node test-raw-output.js npx -y @example/mcp-server');
  process.exit(1);
}

console.log(`Running command: ${command} ${commandArgs.join(' ')}`);

// Prepare environment variables for discovery mode
const env = { 
  ...process.env,
  MCP_LIST_FUNCTIONS: 'true',
  MCP_DISCOVERY_MODE: 'true',
  MCP_REQUIRE_DESCRIPTIONS: 'true',
  MCP_LIST_TOOLS: 'true',
  FUNCTIONS_DISCOVERY: 'true',
  NODE_ENV: 'discovery'
};

// Spawn the process
const childProcess = spawn(command, commandArgs, {
  env,
  shell: true
});

let stdout = '';
let stderr = '';

// Collect stdout
childProcess.stdout.on('data', (data) => {
  const chunk = data.toString();
  stdout += chunk;
  console.log(`[STDOUT] ${chunk}`);
});

// Collect stderr
childProcess.stderr.on('data', (data) => {
  const stderr = data.toString();
  console.error(`[STDERR] ${stderr}`);
});

// Handle process completion
childProcess.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
  
  // Save output to files for analysis
  if (stdout.trim()) {
    const stdoutFile = `mcp-stdout-${Date.now()}.log`;
    fs.writeFileSync(stdoutFile, stdout);
    console.log(`Saved stdout to ${stdoutFile}`);
  }
  
  if (stderr.trim()) {
    const stderrFile = `mcp-stderr-${Date.now()}.log`;
    fs.writeFileSync(stderrFile, stderr);
    console.log(`Saved stderr to ${stderrFile}`);
  }
});

// Handle errors
childProcess.on('error', (error) => {
  console.error(`Error executing command: ${error.message}`);
  process.exit(1);
}); 