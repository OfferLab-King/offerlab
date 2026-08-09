import "server-only";

import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";
const MAX_BYTES = 5_000_000;
const MAX_CHARACTERS = 60_000;
const MAX_PDF_PAGES = 10;
const MAX_DOCX_ENTRIES = 512;
const MAX_DOCX_CENTRAL_DIRECTORY_BYTES = 1_000_000;
const MAX_DOCX_UNCOMPRESSED_BYTES = 20_000_000;
const MAX_DOCX_ENTRY_UNCOMPRESSED_BYTES = 10_000_000;
const MAX_DOCX_COMPRESSION_RATIO = 100;
const MAX_DOCX_ENTRY_COMPRESSION_RATIO = 150;
const MAX_DOCX_NAME_BYTES = 512;
const MAX_DOCX_EXTRA_BYTES = 4_096;
const MAX_DOCX_COMMENT_BYTES = 1_024;
const DOCX_EXTRACTION_TIMEOUT_MILLISECONDS = 8_000;
const DOCX_WORKER_RESULT_CHARACTER_LIMIT = MAX_CHARACTERS * 2;
const PDF_EXTRACTION_TIMEOUT_MILLISECONDS = 8_000;
const PDF_WORKER_RESULT_CHARACTER_LIMIT = MAX_CHARACTERS * 2;

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR = 0x07064b50;
const DATA_DESCRIPTOR = 0x08074b50;
const ZIP64_EXTRA_FIELD = 0x0001;

const docxWorkerSource = String.raw`
"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const path = require("node:path");

Promise.resolve()
  .then(async () => {
    const mammoth = require(path.join(
      process.cwd(),
      "node_modules",
      "mammoth",
      "lib",
      "index.js",
    ));
    const bytes = workerData.bytes;
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const result = await mammoth.extractRawText({ buffer });
    if (typeof result.value !== "string") {
      parentPort.postMessage({ ok: false, code: "career_document_extraction_failed" });
      return;
    }
    if (result.value.length > workerData.maximumCharacters) {
      parentPort.postMessage({ ok: false, code: "career_document_text_too_large" });
      return;
    }
    parentPort.postMessage({
      ok: true,
      text: result.value,
      hasWarnings: Array.isArray(result.messages) && result.messages.length > 0,
    });
  })
  .catch(() => {
    parentPort.postMessage({ ok: false, code: "career_document_extraction_failed" });
  });
`;

const pdfWorkerSource = String.raw`
"use strict";
const { parentPort, workerData } = require("node:worker_threads");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

Promise.resolve()
  .then(async () => {
    const pdfjs = await import(pathToFileURL(path.join(
      process.cwd(),
      "node_modules",
      "pdfjs-dist",
      "legacy",
      "build",
      "pdf.mjs",
    )).href);
    const task = pdfjs.getDocument({
      data: workerData.bytes,
      disableFontFace: true,
      isEvalSupported: false,
      stopAtErrors: true,
      useSystemFonts: false,
      useWorkerFetch: false,
      verbosity: 0,
    });
    let message;
    try {
      const document = await task.promise;
      if (document.numPages > workerData.maximumPages) {
        message = { ok: false, code: "career_document_pdf_too_many_pages" };
      } else {
        const pages = [];
        let characterCount = 0;
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          try {
            const content = await page.getTextContent();
            const text = content.items
              .flatMap((item) => (item && typeof item.str === "string" ? [item.str] : []))
              .join(" ");
            characterCount += text.length;
            if (characterCount > workerData.maximumCharacters) {
              message = { ok: false, code: "career_document_text_too_large" };
              break;
            }
            pages.push(text);
          } finally {
            page.cleanup();
          }
        }
        if (!message) {
          message = {
            ok: true,
            pageCount: document.numPages,
            text: pages.join("\n\n"),
          };
        }
      }
    } finally {
      await task.destroy();
    }
    parentPort.postMessage(message);
  })
  .catch(() => {
    parentPort.postMessage({ ok: false, code: "career_document_extraction_failed" });
  });
`;

export type ExtractedCareerDocument = Readonly<{
  contentText: string;
  filename: string;
  mimeType: typeof DOCX_MIME | typeof PDF_MIME;
  pageCount: number | null;
  sha256: string;
  sizeBytes: number;
  warnings: readonly string[];
}>;

export type UploadEnvelope = Readonly<{
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}>;

function safeFilename(value: string): string {
  return (
    value.replaceAll("\\", "/").split("/").at(-1)?.replaceAll("\0", "").trim().slice(0, 255) ?? ""
  );
}

function isPdf(bytes: Uint8Array): boolean {
  return new TextDecoder("ascii").decode(bytes.slice(0, 5)) === "%PDF-";
}

function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2] ?? -1);
}

type DocxArchiveMetadata = Readonly<{
  entryCount: number;
  ok: true;
  totalCompressedBytes: number;
  totalUncompressedBytes: number;
}>;

type InvalidDocxArchive = Readonly<{
  code: "career_document_docx_archive_invalid";
  ok: false;
}>;

function invalidDocxArchive(): InvalidDocxArchive {
  return { code: "career_document_docx_archive_invalid", ok: false };
}

function findEndOfCentralDirectory(view: DataView): number {
  if (view.byteLength < 22) return -1;
  const firstPossibleOffset = Math.max(0, view.byteLength - 22 - 65_535);
  for (let offset = view.byteLength - 22; offset >= firstPossibleOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== END_OF_CENTRAL_DIRECTORY) continue;
    const commentLength = view.getUint16(offset + 20, true);
    if (offset + 22 + commentLength === view.byteLength) return offset;
  }
  return -1;
}

function hasSafeExtraFields(view: DataView, offset: number, length: number): boolean {
  const end = offset + length;
  let cursor = offset;
  while (cursor < end) {
    if (cursor + 4 > end) return false;
    const identifier = view.getUint16(cursor, true);
    const size = view.getUint16(cursor + 2, true);
    if (identifier === ZIP64_EXTRA_FIELD || cursor + 4 + size > end) return false;
    cursor += 4 + size;
  }
  return cursor === end;
}

function sameBytes(
  bytes: Uint8Array,
  leftOffset: number,
  rightOffset: number,
  length: number,
): boolean {
  for (let index = 0; index < length; index += 1) {
    if (bytes[leftOffset + index] !== bytes[rightOffset + index]) return false;
  }
  return true;
}

function decodeZipEntryName(bytes: Uint8Array, utf8: boolean): string | null {
  try {
    return new TextDecoder(utf8 ? "utf-8" : "latin1", { fatal: utf8 }).decode(bytes);
  } catch {
    return null;
  }
}

function safeZipEntryName(value: string): boolean {
  if (!value || value.includes("\0") || value.includes("\\") || value.startsWith("/")) {
    return false;
  }
  const path = value.endsWith("/") ? value.slice(0, -1) : value;
  if (!path) return false;
  const parts = path.split("/");
  return parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

/**
 * Validates the central directory before any DOCX entry is decompressed. The
 * parser deliberately accepts only the small subset of ZIP used by OOXML:
 * single-disk, non-ZIP64, unencrypted store/deflate archives.
 */
export function validateDocxArchiveMetadata(
  bytes: Uint8Array,
): DocxArchiveMetadata | InvalidDocxArchive {
  try {
    if (!isZip(bytes)) return invalidDocxArchive();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const endOffset = findEndOfCentralDirectory(view);
    if (endOffset < 0) return invalidDocxArchive();

    const commentLength = view.getUint16(endOffset + 20, true);
    if (commentLength > MAX_DOCX_COMMENT_BYTES) return invalidDocxArchive();
    if (view.getUint16(endOffset + 4, true) !== 0 || view.getUint16(endOffset + 6, true) !== 0) {
      return invalidDocxArchive();
    }
    const entriesOnDisk = view.getUint16(endOffset + 8, true);
    const entryCount = view.getUint16(endOffset + 10, true);
    const centralDirectoryBytes = view.getUint32(endOffset + 12, true);
    const centralDirectoryOffset = view.getUint32(endOffset + 16, true);
    if (
      entryCount < 1 ||
      entryCount !== entriesOnDisk ||
      entryCount === 0xffff ||
      centralDirectoryBytes === 0xffffffff ||
      centralDirectoryOffset === 0xffffffff ||
      entryCount > MAX_DOCX_ENTRIES ||
      centralDirectoryBytes > MAX_DOCX_CENTRAL_DIRECTORY_BYTES ||
      centralDirectoryOffset + centralDirectoryBytes !== endOffset
    ) {
      return invalidDocxArchive();
    }
    if (
      endOffset >= 20 &&
      view.getUint32(endOffset - 20, true) === ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR
    ) {
      return invalidDocxArchive();
    }

    let cursor = centralDirectoryOffset;
    let totalCompressedBytes = 0;
    let totalUncompressedBytes = 0;
    const entryNames = new Set<string>();
    const localRanges: Array<Readonly<{ end: number; start: number }>> = [];

    for (let index = 0; index < entryCount; index += 1) {
      if (cursor + 46 > endOffset || view.getUint32(cursor, true) !== CENTRAL_DIRECTORY_HEADER) {
        return invalidDocxArchive();
      }
      const flags = view.getUint16(cursor + 8, true);
      const compressionMethod = view.getUint16(cursor + 10, true);
      const compressedBytes = view.getUint32(cursor + 20, true);
      const uncompressedBytes = view.getUint32(cursor + 24, true);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const entryCommentLength = view.getUint16(cursor + 32, true);
      const diskStart = view.getUint16(cursor + 34, true);
      const localHeaderOffset = view.getUint32(cursor + 42, true);
      const variableLength = nameLength + extraLength + entryCommentLength;
      if (
        (flags & (0x0001 | 0x0040 | 0x2000)) !== 0 ||
        ![0, 8].includes(compressionMethod) ||
        compressedBytes === 0xffffffff ||
        uncompressedBytes === 0xffffffff ||
        diskStart !== 0 ||
        localHeaderOffset === 0xffffffff ||
        nameLength < 1 ||
        nameLength > MAX_DOCX_NAME_BYTES ||
        extraLength > MAX_DOCX_EXTRA_BYTES ||
        entryCommentLength > MAX_DOCX_COMMENT_BYTES ||
        cursor + 46 + variableLength > endOffset
      ) {
        return invalidDocxArchive();
      }

      const nameOffset = cursor + 46;
      const extraOffset = nameOffset + nameLength;
      if (!hasSafeExtraFields(view, extraOffset, extraLength)) return invalidDocxArchive();
      const name = decodeZipEntryName(
        bytes.subarray(nameOffset, nameOffset + nameLength),
        (flags & 0x0800) !== 0,
      );
      if (!name || !safeZipEntryName(name) || entryNames.has(name)) {
        return invalidDocxArchive();
      }
      entryNames.add(name);

      if (
        localHeaderOffset + 30 > centralDirectoryOffset ||
        view.getUint32(localHeaderOffset, true) !== LOCAL_FILE_HEADER
      ) {
        return invalidDocxArchive();
      }
      const localFlags = view.getUint16(localHeaderOffset + 6, true);
      const localCompressionMethod = view.getUint16(localHeaderOffset + 8, true);
      const localCompressedBytes = view.getUint32(localHeaderOffset + 18, true);
      const localUncompressedBytes = view.getUint32(localHeaderOffset + 22, true);
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const localNameOffset = localHeaderOffset + 30;
      const localExtraOffset = localNameOffset + localNameLength;
      const compressedDataOffset = localExtraOffset + localExtraLength;
      if (
        localFlags !== flags ||
        localCompressionMethod !== compressionMethod ||
        localNameLength !== nameLength ||
        localExtraLength > MAX_DOCX_EXTRA_BYTES ||
        compressedDataOffset > centralDirectoryOffset ||
        compressedBytes > centralDirectoryOffset - compressedDataOffset ||
        !sameBytes(bytes, nameOffset, localNameOffset, nameLength) ||
        !hasSafeExtraFields(view, localExtraOffset, localExtraLength)
      ) {
        return invalidDocxArchive();
      }
      const usesDataDescriptor = (flags & 0x0008) !== 0;
      if (
        (!usesDataDescriptor &&
          (localCompressedBytes !== compressedBytes ||
            localUncompressedBytes !== uncompressedBytes)) ||
        localCompressedBytes === 0xffffffff ||
        localUncompressedBytes === 0xffffffff
      ) {
        return invalidDocxArchive();
      }

      let localRangeEnd = compressedDataOffset + compressedBytes;
      if (usesDataDescriptor) {
        const hasSignature =
          localRangeEnd + 4 <= centralDirectoryOffset &&
          view.getUint32(localRangeEnd, true) === DATA_DESCRIPTOR;
        const descriptorOffset = localRangeEnd + (hasSignature ? 4 : 0);
        if (
          descriptorOffset + 12 > centralDirectoryOffset ||
          view.getUint32(descriptorOffset + 4, true) !== compressedBytes ||
          view.getUint32(descriptorOffset + 8, true) !== uncompressedBytes
        ) {
          return invalidDocxArchive();
        }
        localRangeEnd = descriptorOffset + 12;
      }
      localRanges.push({ end: localRangeEnd, start: localHeaderOffset });

      const isDirectory = name.endsWith("/");
      if (isDirectory && (compressedBytes !== 0 || uncompressedBytes !== 0)) {
        return invalidDocxArchive();
      }
      if (
        uncompressedBytes > MAX_DOCX_ENTRY_UNCOMPRESSED_BYTES ||
        (uncompressedBytes > 0 && compressedBytes === 0) ||
        (compressionMethod === 0 && compressedBytes !== uncompressedBytes) ||
        (compressedBytes > 0 &&
          uncompressedBytes / compressedBytes > MAX_DOCX_ENTRY_COMPRESSION_RATIO)
      ) {
        return invalidDocxArchive();
      }
      totalCompressedBytes += compressedBytes;
      totalUncompressedBytes += uncompressedBytes;
      if (totalUncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
        return invalidDocxArchive();
      }
      cursor += 46 + variableLength;
    }

    if (
      cursor !== endOffset ||
      !entryNames.has("[Content_Types].xml") ||
      !entryNames.has("word/document.xml") ||
      totalCompressedBytes < 1 ||
      totalUncompressedBytes / totalCompressedBytes > MAX_DOCX_COMPRESSION_RATIO
    ) {
      return invalidDocxArchive();
    }
    localRanges.sort((left, right) => left.start - right.start);
    for (let index = 1; index < localRanges.length; index += 1) {
      const previous = localRanges[index - 1];
      const current = localRanges[index];
      if (!previous || !current || previous.end > current.start) return invalidDocxArchive();
    }
    return { entryCount, ok: true, totalCompressedBytes, totalUncompressedBytes };
  } catch {
    return invalidDocxArchive();
  }
}

export function validateUploadEnvelope(
  input: UploadEnvelope,
):
  | Readonly<{ filename: string; mimeType: typeof DOCX_MIME | typeof PDF_MIME; ok: true }>
  | Readonly<{ code: string; ok: false }> {
  const filename = safeFilename(input.filename);
  if (!filename || input.sizeBytes < 1 || input.sizeBytes !== input.bytes.byteLength) {
    return { code: "career_document_file_invalid", ok: false };
  }
  if (input.sizeBytes > MAX_BYTES) return { code: "career_document_file_too_large", ok: false };
  const extension = filename.toLowerCase().match(/\.[a-z0-9]+$/u)?.[0];
  if (extension === ".pdf" && input.mimeType === PDF_MIME && isPdf(input.bytes)) {
    return { filename, mimeType: PDF_MIME, ok: true };
  }
  if (extension === ".docx" && input.mimeType === DOCX_MIME && isZip(input.bytes)) {
    return { filename, mimeType: DOCX_MIME, ok: true };
  }
  return { code: "career_document_file_type_invalid", ok: false };
}

function normalizeExtractedText(value: string): string {
  return value
    .replaceAll("\0", "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[\t\f\v]+/gu, " ")
    .replace(/ +\n/gu, "\n")
    .replace(/\n{4,}/gu, "\n\n\n")
    .trim();
}

type PdfWorkerMessage =
  | Readonly<{ ok: true; pageCount: number; text: string }>
  | Readonly<{
      code:
        | "career_document_extraction_failed"
        | "career_document_pdf_too_many_pages"
        | "career_document_text_too_large";
      ok: false;
    }>;

function isPdfWorkerMessage(value: unknown): value is PdfWorkerMessage {
  if (!value || typeof value !== "object" || !("ok" in value)) return false;
  if (value.ok === true) {
    return (
      "pageCount" in value &&
      Number.isInteger(value.pageCount) &&
      Number(value.pageCount) >= 1 &&
      Number(value.pageCount) <= MAX_PDF_PAGES &&
      "text" in value &&
      typeof value.text === "string" &&
      value.text.length <= PDF_WORKER_RESULT_CHARACTER_LIMIT
    );
  }
  return (
    value.ok === false &&
    "code" in value &&
    [
      "career_document_extraction_failed",
      "career_document_pdf_too_many_pages",
      "career_document_text_too_large",
    ].includes(String(value.code))
  );
}

export async function extractPdfInBoundedWorker(
  bytes: Uint8Array,
  options: Readonly<{ timeoutMilliseconds?: number }> = {},
): Promise<Readonly<{ pageCount: number; text: string }>> {
  const timeoutMilliseconds = options.timeoutMilliseconds ?? PDF_EXTRACTION_TIMEOUT_MILLISECONDS;
  if (
    !Number.isSafeInteger(timeoutMilliseconds) ||
    timeoutMilliseconds < 1 ||
    timeoutMilliseconds > PDF_EXTRACTION_TIMEOUT_MILLISECONDS
  ) {
    throw new TypeError("PDF extraction timeout is outside the permitted boundary");
  }

  const workerBytes = Uint8Array.from(bytes);
  let worker: Worker;
  try {
    worker = new Worker(pdfWorkerSource, {
      eval: true,
      execArgv: [],
      name: "offerlab-pdf-extractor",
      resourceLimits: {
        codeRangeSizeMb: 16,
        maxOldGenerationSizeMb: 64,
        maxYoungGenerationSizeMb: 16,
        stackSizeMb: 4,
      },
      transferList: [workerBytes.buffer],
      workerData: {
        bytes: workerBytes,
        maximumCharacters: PDF_WORKER_RESULT_CHARACTER_LIMIT,
        maximumPages: MAX_PDF_PAGES,
      },
    });
  } catch {
    throw new Error("career_document_extraction_failed");
  }

  return await new Promise((resolve, reject) => {
    let settled = false;
    const stop = () => {
      clearTimeout(timer);
      worker.removeAllListeners();
      void worker.terminate();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      stop();
      reject(error);
    };
    const succeed = (value: Readonly<{ pageCount: number; text: string }>) => {
      if (settled) return;
      settled = true;
      stop();
      resolve(value);
    };
    const timer = setTimeout(() => {
      fail(new Error("career_document_extraction_timeout"));
    }, timeoutMilliseconds);
    timer.unref();

    worker.once("message", (message: unknown) => {
      if (!isPdfWorkerMessage(message)) {
        fail(new Error("career_document_extraction_failed"));
        return;
      }
      if (!message.ok) {
        fail(new Error(message.code));
        return;
      }
      succeed({ pageCount: message.pageCount, text: message.text });
    });
    worker.once("error", () => {
      fail(new Error("career_document_extraction_failed"));
    });
    worker.once("exit", () => {
      if (!settled) {
        fail(new Error("career_document_extraction_failed"));
      }
    });
  });
}

type DocxWorkerMessage =
  | Readonly<{ hasWarnings: boolean; ok: true; text: string }>
  | Readonly<{
      code: "career_document_extraction_failed" | "career_document_text_too_large";
      ok: false;
    }>;

function isDocxWorkerMessage(value: unknown): value is DocxWorkerMessage {
  if (!value || typeof value !== "object" || !("ok" in value)) return false;
  if (value.ok === true) {
    return (
      "text" in value &&
      typeof value.text === "string" &&
      value.text.length <= DOCX_WORKER_RESULT_CHARACTER_LIMIT &&
      "hasWarnings" in value &&
      typeof value.hasWarnings === "boolean"
    );
  }
  return (
    value.ok === false &&
    "code" in value &&
    ["career_document_extraction_failed", "career_document_text_too_large"].includes(
      String(value.code),
    )
  );
}

export async function extractDocxInBoundedWorker(
  bytes: Uint8Array,
  options: Readonly<{ timeoutMilliseconds?: number }> = {},
): Promise<Readonly<{ hasWarnings: boolean; text: string }>> {
  const timeoutMilliseconds = options.timeoutMilliseconds ?? DOCX_EXTRACTION_TIMEOUT_MILLISECONDS;
  if (
    !Number.isSafeInteger(timeoutMilliseconds) ||
    timeoutMilliseconds < 1 ||
    timeoutMilliseconds > DOCX_EXTRACTION_TIMEOUT_MILLISECONDS
  ) {
    throw new TypeError("DOCX extraction timeout is outside the permitted boundary");
  }

  const workerBytes = Uint8Array.from(bytes);
  let worker: Worker;
  try {
    worker = new Worker(docxWorkerSource, {
      eval: true,
      execArgv: [],
      name: "offerlab-docx-extractor",
      resourceLimits: {
        codeRangeSizeMb: 16,
        maxOldGenerationSizeMb: 64,
        maxYoungGenerationSizeMb: 16,
        stackSizeMb: 4,
      },
      transferList: [workerBytes.buffer],
      workerData: {
        bytes: workerBytes,
        maximumCharacters: DOCX_WORKER_RESULT_CHARACTER_LIMIT,
      },
    });
  } catch {
    throw new Error("career_document_extraction_failed");
  }

  return await new Promise((resolve, reject) => {
    let settled = false;
    const stop = () => {
      clearTimeout(timer);
      worker.removeAllListeners();
      void worker.terminate();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      stop();
      reject(error);
    };
    const succeed = (value: Readonly<{ hasWarnings: boolean; text: string }>) => {
      if (settled) return;
      settled = true;
      stop();
      resolve(value);
    };
    const timer = setTimeout(() => {
      fail(new Error("career_document_extraction_timeout"));
    }, timeoutMilliseconds);
    timer.unref();

    worker.once("message", (message: unknown) => {
      if (!isDocxWorkerMessage(message)) {
        fail(new Error("career_document_extraction_failed"));
        return;
      }
      if (!message.ok) {
        fail(new Error(message.code));
        return;
      }
      succeed({ hasWarnings: message.hasWarnings, text: message.text });
    });
    worker.once("error", () => {
      fail(new Error("career_document_extraction_failed"));
    });
    worker.once("exit", () => {
      if (!settled) {
        fail(new Error("career_document_extraction_failed"));
      }
    });
  });
}

async function extractDocx(bytes: Uint8Array) {
  const result = await extractDocxInBoundedWorker(bytes);
  return {
    pageCount: null,
    text: result.text,
    warnings: result.hasWarnings
      ? ["Some document features were omitted from extracted text."]
      : [],
  };
}

export async function extractCareerDocument(file: File): Promise<ExtractedCareerDocument> {
  if (!(file instanceof File)) throw new Error("career_document_file_invalid");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const envelope = validateUploadEnvelope({
    bytes,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (!envelope.ok) throw new Error(envelope.code);
  if (envelope.mimeType === DOCX_MIME) {
    const archive = validateDocxArchiveMetadata(bytes);
    if (!archive.ok) throw new Error(archive.code);
  }
  let extracted: { pageCount: number | null; text: string; warnings?: readonly string[] };
  try {
    extracted =
      envelope.mimeType === PDF_MIME
        ? await extractPdfInBoundedWorker(bytes)
        : await extractDocx(bytes);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("career_document_")) throw error;
    throw new Error("career_document_extraction_failed");
  }
  const contentText = normalizeExtractedText(extracted.text);
  if (contentText.length < 40) throw new Error("career_document_no_extractable_text");
  if (contentText.length > MAX_CHARACTERS) throw new Error("career_document_text_too_large");
  return {
    contentText,
    filename: envelope.filename,
    mimeType: envelope.mimeType,
    pageCount: extracted.pageCount,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: file.size,
    warnings: extracted.warnings ?? [],
  };
}

export const careerDocumentUploadLimits = {
  docxExtractionTimeoutMilliseconds: DOCX_EXTRACTION_TIMEOUT_MILLISECONDS,
  maximumDocxCompressionRatio: MAX_DOCX_COMPRESSION_RATIO,
  maximumDocxEntries: MAX_DOCX_ENTRIES,
  maximumDocxUncompressedBytes: MAX_DOCX_UNCOMPRESSED_BYTES,
  maximumBytes: MAX_BYTES,
  maximumPdfPages: MAX_PDF_PAGES,
  pdfExtractionTimeoutMilliseconds: PDF_EXTRACTION_TIMEOUT_MILLISECONDS,
} as const;
