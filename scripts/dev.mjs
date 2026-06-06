import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';

const port = process.env.PORT || '5173';
const host = process.env.HOST || '0.0.0.0';

function getWifiAddress() {
  const nets = networkInterfaces();
  const entries = Object.entries(nets);
  const preferredNames = ['wi-fi', 'wifi', 'wlan', 'wireless'];

  const candidates = entries.flatMap(([name, addresses]) =>
    (addresses || [])
      .filter((address) => address.family === 'IPv4' && !address.internal)
      .map((address) => ({ name, address: address.address }))
  );

  const wifi = candidates.find((item) => preferredNames.some((keyword) => item.name.toLowerCase().includes(keyword)));
  const privateAddress = candidates.find((item) => item.address.startsWith('192.168.'))
    || candidates.find((item) => item.address.startsWith('10.'))
    || candidates.find((item) => item.address.startsWith('172.'));

  return wifi?.address || privateAddress?.address || candidates[0]?.address || null;
}

const wifiAddress = getWifiAddress();

console.log('CuteBead dev server');
console.log(`Local:   http://localhost:${port}/`);
if (wifiAddress) {
  console.log(`Wi-Fi:   http://${wifiAddress}:${port}/`);
}
console.log('');

const viteBin = process.platform === 'win32' ? 'vite.cmd' : 'vite';
const child = spawn(viteBin, ['--host', host, '--port', port, '--clearScreen', 'false'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: false,
});

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  if (!text.includes('Local:') && !text.includes('Network:')) {
    process.stdout.write(text);
  }
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
