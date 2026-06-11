import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const VERSION = '3.12.88.120';
const COPYRIGHT = 'CopyRight 2026 WebSSH - Github Develop Team';
const PRODUCT_NAME = 'EasySSH';
const INTERNAL_NAME = 'EasySSH';

const rceditPath = path.join(
  projectRoot,
  'node_modules',
  'electron-winstaller',
  'vendor',
  'rcedit.exe'
);

const targetExecutables = [
  path.join(projectRoot, 'dist', 'win-unpacked', 'EasySSH.exe'),
  path.join(projectRoot, 'dist', 'win-unpacked', 'webssh.exe')
];

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function updateExecutableMetadata(executablePath) {
  const args = [
    executablePath,
    '--set-file-version',
    VERSION,
    '--set-product-version',
    VERSION,
    '--set-version-string',
    'FileVersion',
    VERSION,
    '--set-version-string',
    'ProductVersion',
    VERSION,
    '--set-version-string',
    'FileDescription',
    PRODUCT_NAME,
    '--set-version-string',
    'ProductName',
    PRODUCT_NAME,
    '--set-version-string',
    'InternalName',
    INTERNAL_NAME,
    '--set-version-string',
    'OriginalFilename',
    path.basename(executablePath),
    '--set-version-string',
    'LegalCopyright',
    COPYRIGHT
  ];

  await execFile(rceditPath, args, { cwd: projectRoot });
}

async function main() {
  if (!(await exists(rceditPath))) {
    throw new Error(`rcedit.exe not found: ${rceditPath}`);
  }

  for (const executablePath of targetExecutables) {
    if (!(await exists(executablePath))) {
      continue;
    }

    await updateExecutableMetadata(executablePath);
    console.log(`[postbuild] Updated version info: ${executablePath}`);
  }
}

main().catch((error) => {
  console.error('[postbuild] Failed to update Windows executable metadata.');
  console.error(error);
  process.exitCode = 1;
});
