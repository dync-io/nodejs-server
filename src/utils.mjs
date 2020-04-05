import crypto from 'crypto';

export function genSocketId() {
  const random = crypto.randomBytes(8).buffer;
  const first = new DataView(random, 0, 4).getUint32();
  const last  = new DataView(random, 4, 4).getUint32().toString().padEnd(10, '0');
  return `${first}.${last}`;
}

export function genString(size = 20) {
  return crypto.randomBytes(size / 2).toString('hex');
}

export function encode(event, data, channel) {
  return JSON.stringify({
    event,
    data: JSON.stringify(data),
    channel
  });
}
  