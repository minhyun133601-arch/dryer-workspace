import { deflateRawSync } from 'node:zlib';

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

// One UTF-8 named, DEFLATE-compressed file in a portable ZIP32 archive. A fixed
// DOS timestamp (1980-01-01) keeps identical exports byte-for-byte reproducible.
export function zipSingleFile(filename, bytes) {
  if (typeof filename !== 'string' || !filename || /[\\/\0]/.test(filename) || filename === '.' || filename === '..') {
    throw new Error('ZIP filename must be a single, nonempty filename.');
  }
  const name = Buffer.from(filename, 'utf8');
  if (name.length > 0xffff) throw new Error('ZIP filename is too long.');
  const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (source.length > 0xffffffff) throw new Error('ZIP32 source is too large.');
  const compressed = deflateRawSync(source, { level: 9 });
  const checksum = crc32(source);
  const localLength = 30 + name.length;
  const directoryOffset = localLength + compressed.length;
  const directoryLength = 46 + name.length;
  if (directoryOffset + directoryLength + 22 > 0xffffffff) throw new Error('ZIP32 archive is too large.');

  const local = Buffer.alloc(localLength);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(33, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(source.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);

  const directory = Buffer.alloc(directoryLength);
  directory.writeUInt32LE(0x02014b50, 0);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(0x0800, 8);
  directory.writeUInt16LE(8, 10);
  directory.writeUInt16LE(33, 14);
  directory.writeUInt32LE(checksum, 16);
  directory.writeUInt32LE(compressed.length, 20);
  directory.writeUInt32LE(source.length, 24);
  directory.writeUInt16LE(name.length, 28);
  name.copy(directory, 46);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(directoryLength, 12);
  end.writeUInt32LE(directoryOffset, 16);
  return Buffer.concat([local, compressed, directory, end]);
}
