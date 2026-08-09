import { describe, expect, it } from "vitest";
import {
  careerDocumentUploadLimits,
  extractDocxInBoundedWorker,
  extractPdfInBoundedWorker,
  validateDocxArchiveMetadata,
  validateUploadEnvelope,
} from "./document-extractor";

type ArchiveEntry = Readonly<{
  compressedBytes?: number;
  flags?: number;
  method?: 0 | 8;
  name: string;
  uncompressedBytes?: number;
}>;

function join(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function archive(entries: readonly ArchiveEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const localOffsets: number[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const compressedBytes = entry.compressedBytes ?? 1;
    const uncompressedBytes = entry.uncompressedBytes ?? compressedBytes;
    const flags = entry.flags ?? 0;
    const method = entry.method ?? 0;
    const local = new Uint8Array(30 + name.byteLength + compressedBytes);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, flags, true);
    view.setUint16(8, method, true);
    view.setUint32(18, compressedBytes, true);
    view.setUint32(22, uncompressedBytes, true);
    view.setUint16(26, name.byteLength, true);
    local.set(name, 30);
    localOffsets.push(localOffset);
    localOffset += local.byteLength;
    localParts.push(local);
  }

  entries.forEach((entry, index) => {
    const name = encoder.encode(entry.name);
    const compressedBytes = entry.compressedBytes ?? 1;
    const uncompressedBytes = entry.uncompressedBytes ?? compressedBytes;
    const central = new Uint8Array(46 + name.byteLength);
    const view = new DataView(central.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, entry.flags ?? 0, true);
    view.setUint16(10, entry.method ?? 0, true);
    view.setUint32(20, compressedBytes, true);
    view.setUint32(24, uncompressedBytes, true);
    view.setUint16(28, name.byteLength, true);
    view.setUint32(42, localOffsets[index] ?? 0, true);
    central.set(name, 46);
    centralParts.push(central);
  });

  const local = join(localParts);
  const central = join(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, central.byteLength, true);
  endView.setUint32(16, local.byteLength, true);
  return join([local, central, end]);
}

function standardEntries(overrides: readonly ArchiveEntry[] = []): readonly ArchiveEntry[] {
  return [{ name: "[Content_Types].xml" }, { name: "word/document.xml" }, ...overrides];
}

function firstCentralDirectoryOffset(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = 0; offset <= bytes.byteLength - 4; offset += 1) {
    if (view.getUint32(offset, true) === 0x02014b50) return offset;
  }
  throw new Error("missing central directory");
}

describe("career document upload envelope", () => {
  it("accepts a matching PDF extension, MIME type and signature", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 example");
    expect(
      validateUploadEnvelope({
        bytes,
        filename: "candidate.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength,
      }),
    ).toMatchObject({ mimeType: "application/pdf", ok: true });
  });

  it("rejects a spoofed PDF and legacy or macro-enabled Word files", () => {
    const bytes = new TextEncoder().encode("not a pdf");
    expect(
      validateUploadEnvelope({
        bytes,
        filename: "candidate.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength,
      }),
    ).toEqual({ code: "career_document_file_type_invalid", ok: false });
    expect(
      validateUploadEnvelope({
        bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
        filename: "candidate.docm",
        mimeType: "application/vnd.ms-word.document.macroEnabled.12",
        sizeBytes: 4,
      }),
    ).toEqual({ code: "career_document_file_type_invalid", ok: false });
  });

  it("rejects path-like filenames and mismatched sizes safely", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7 example");
    expect(
      validateUploadEnvelope({
        bytes,
        filename: "../../candidate.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength + 1,
      }),
    ).toEqual({ code: "career_document_file_invalid", ok: false });
  });
});

describe("DOCX archive safety boundary", () => {
  it("accepts a small standard OOXML archive", () => {
    expect(validateDocxArchiveMetadata(archive(standardEntries()))).toMatchObject({
      entryCount: 2,
      ok: true,
      totalUncompressedBytes: 2,
    });
  });

  it("rejects ZIP64 metadata and encrypted entries", () => {
    const zip64 = archive(standardEntries());
    const zip64View = new DataView(zip64.buffer);
    zip64View.setUint32(firstCentralDirectoryOffset(zip64) + 24, 0xffffffff, true);
    expect(validateDocxArchiveMetadata(zip64)).toEqual({
      code: "career_document_docx_archive_invalid",
      ok: false,
    });

    expect(
      validateDocxArchiveMetadata(
        archive([{ flags: 0x0001, name: "[Content_Types].xml" }, { name: "word/document.xml" }]),
      ),
    ).toMatchObject({ ok: false });
  });

  it("rejects excessive entries before decompression", () => {
    const excessiveEntries: ArchiveEntry[] = [...standardEntries()];
    for (let index = 2; index <= careerDocumentUploadLimits.maximumDocxEntries; index += 1) {
      excessiveEntries.push({ name: `word/item-${index}.xml` });
    }

    expect(validateDocxArchiveMetadata(archive(excessiveEntries))).toMatchObject({ ok: false });
  });

  it("rejects excessive per-entry and aggregate expansion ratios", () => {
    expect(
      validateDocxArchiveMetadata(
        archive([
          { compressedBytes: 1, method: 8, name: "[Content_Types].xml", uncompressedBytes: 200 },
          { name: "word/document.xml" },
        ]),
      ),
    ).toMatchObject({ ok: false });

    expect(
      validateDocxArchiveMetadata(
        archive([
          {
            compressedBytes: 70_000,
            method: 8,
            name: "[Content_Types].xml",
            uncompressedBytes: 7_000_000,
          },
          {
            compressedBytes: 70_000,
            method: 8,
            name: "word/document.xml",
            uncompressedBytes: 7_000_000,
          },
          {
            compressedBytes: 70_000,
            method: 8,
            name: "word/styles.xml",
            uncompressedBytes: 7_000_000,
          },
        ]),
      ),
    ).toMatchObject({ ok: false });
  });

  it("terminates Mammoth at the worker wall-time boundary", async () => {
    await expect(
      extractDocxInBoundedWorker(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
        timeoutMilliseconds: 1,
      }),
    ).rejects.toThrow("career_document_extraction_timeout");
  });

  it("terminates PDF.js at the worker wall-time boundary", async () => {
    await expect(
      extractPdfInBoundedWorker(new TextEncoder().encode("%PDF-1.7 example"), {
        timeoutMilliseconds: 1,
      }),
    ).rejects.toThrow("career_document_extraction_timeout");
  });
});
