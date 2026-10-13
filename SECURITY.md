# Security

Forge v0.1.0 is an early preview. Import only maps/projects from sources you trust, and use your own game's SDK executables when building.

Do not report suspected vulnerabilities in a public issue if the report includes credentials, private maps or an exploitable sample. Use this repository's **Security → Report a vulnerability** entry if private reporting is available. Otherwise, contact the repository owner privately through a channel you already trust. No response-time guarantee is offered.

Include the Forge version, operating system, affected files and a minimal reproduction. Describe the impact without publishing private information.

The Electron renderer runs with context isolation and without Node.js integration. The SDK bridge invokes configured executables without a shell. These controls do not replace review and validation of imported files or selected SDK binaries.
