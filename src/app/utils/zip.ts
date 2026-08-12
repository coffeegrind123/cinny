/**
 * A minimal ZIP writer, store-only (no compression).
 *
 * Written rather than pulled in as a dependency because the only thing an
 * export bundles is media that is already compressed — jpeg, png, mp4, ogg —
 * where deflate buys nothing but CPU, and because the store-only format is
 * about a hundred lines of well-specified structure. See APPNOTE.TXT sections
 * 4.3.7 (local header), 4.3.12 (central directory) and 4.3.16 (end record).
 *
 * Deliberately not streaming: an export is assembled in memory and handed to
 * the browser as one blob, so the caller is responsible for keeping the total
 * within reach of the device. The exporter caps its own range for that reason.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

/** DOS date/time, which is what ZIP stores. Second resolution is 2s. */
const dosDateTime = (date: Date): { time: number; date: number } => ({
  time:
    (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f),

  date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
});

export type ZipEntry = {
  /** Path inside the archive. Forward slashes only. */
  name: string;
  data: Uint8Array;
  modified?: Date;
};

type CentralRecord = {
  nameBytes: Uint8Array;
  crc: number;
  size: number;
  offset: number;
  time: number;
  date: number;
};

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_HEADER_SIG = 0x02014b50;
const END_RECORD_SIG = 0x06054b50;

export const createZip = (entries: ZipEntry[]): Blob => {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: CentralRecord[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const { time, date } = dosDateTime(entry.modified ?? new Date(0));

    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, LOCAL_HEADER_SIG, true);
    header.setUint16(4, 20, true); // version needed
    // Bit 11 marks the name as UTF-8, which matters the moment a filename is
    // not ASCII — without it, archivers guess at a legacy codepage.
    header.setUint16(6, 0x0800, true);
    header.setUint16(8, 0, true); // method: stored
    header.setUint16(10, time, true);
    header.setUint16(12, date, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, entry.data.length, true);
    header.setUint32(22, entry.data.length, true);
    header.setUint16(26, nameBytes.length, true);
    header.setUint16(28, 0, true); // extra field length

    parts.push(header.buffer, nameBytes as BlobPart, entry.data as BlobPart);
    central.push({ nameBytes, crc, size: entry.data.length, offset, time, date });
    offset += 30 + nameBytes.length + entry.data.length;
  });

  const centralStart = offset;
  central.forEach((record) => {
    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, CENTRAL_HEADER_SIG, true);
    header.setUint16(4, 20, true); // version made by
    header.setUint16(6, 20, true); // version needed
    header.setUint16(8, 0x0800, true);
    header.setUint16(10, 0, true); // method: stored
    header.setUint16(12, record.time, true);
    header.setUint16(14, record.date, true);
    header.setUint32(16, record.crc, true);
    header.setUint32(20, record.size, true);
    header.setUint32(24, record.size, true);
    header.setUint16(28, record.nameBytes.length, true);
    header.setUint16(30, 0, true); // extra
    header.setUint16(32, 0, true); // comment
    header.setUint16(34, 0, true); // disk number
    header.setUint16(36, 0, true); // internal attrs
    header.setUint32(38, 0, true); // external attrs
    header.setUint32(42, record.offset, true);

    parts.push(header.buffer, record.nameBytes as BlobPart);
    offset += 46 + record.nameBytes.length;
  });

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, END_RECORD_SIG, true);
  end.setUint16(4, 0, true);
  end.setUint16(6, 0, true);
  end.setUint16(8, central.length, true);
  end.setUint16(10, central.length, true);
  end.setUint32(12, offset - centralStart, true);
  end.setUint32(16, centralStart, true);
  end.setUint16(20, 0, true);
  parts.push(end.buffer);

  return new Blob(parts, { type: 'application/zip' });
};
