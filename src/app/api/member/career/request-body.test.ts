import { describe, expect, it } from "vitest";
import {
  careerRequestBodyLimits,
  readBoundedFormDataBody,
  readBoundedJsonBody,
  readBoundedRequestBody,
} from "./request-body";

function chunkedRequest(
  chunks: readonly Uint8Array[],
  headers?: HeadersInit,
  onCancel?: () => void,
): Request {
  let next = 0;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      onCancel?.();
    },
    pull(controller) {
      const chunk = chunks[next];
      if (!chunk) {
        controller.close();
        return;
      }
      next += 1;
      controller.enqueue(chunk);
    },
  });
  return new Request("http://offerlab.test/api/member/jobs/search", {
    body,
    headers,
    method: "POST",
    // Undici requires duplex when a stream is used as a request body.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("bounded career request bodies", () => {
  it("stops a chunked body with no Content-Length once the hard ceiling is crossed", async () => {
    let cancelled = false;
    const request = chunkedRequest(
      [new Uint8Array(6), new Uint8Array(5), new Uint8Array(500)],
      undefined,
      () => {
        cancelled = true;
      },
    );

    await expect(readBoundedRequestBody(request, 10)).rejects.toMatchObject({
      reason: "too_large",
    });
    expect(cancelled).toBe(true);
  });

  it("counts the stream even when Content-Length understates the body", async () => {
    const request = chunkedRequest([new Uint8Array(4), new Uint8Array(4)], {
      "content-length": "2",
    });

    await expect(readBoundedRequestBody(request, 7)).rejects.toMatchObject({
      reason: "too_large",
    });
  });

  it("rejects a declared oversized body before consuming its stream", async () => {
    let pulled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulled = true;
          controller.enqueue(new Uint8Array([1]));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request("http://offerlab.test/api/member/jobs", {
      body,
      headers: { "content-length": "1000" },
      method: "POST",
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readBoundedRequestBody(request, 10)).rejects.toMatchObject({
      reason: "too_large",
    });
    expect(pulled).toBe(false);
  });

  it("parses JSON at the exact byte ceiling and rejects invalid UTF-8", async () => {
    const json = new TextEncoder().encode('{"query":"developer"}');
    await expect(readBoundedJsonBody(chunkedRequest([json]), json.byteLength)).resolves.toEqual({
      query: "developer",
    });

    await expect(
      readBoundedJsonBody(chunkedRequest([new Uint8Array([0xc3, 0x28])]), 10),
    ).rejects.toMatchObject({ reason: "invalid" });
  });

  it("parses bounded multipart data from a chunked upload", async () => {
    const form = new FormData();
    form.set("kind", "cv");
    form.set("title", "Graduate CV");
    form.set("file", new File(["%PDF-1.7 example"], "candidate.pdf", { type: "application/pdf" }));
    const encoded = new Request("http://offerlab.test/upload", { body: form, method: "POST" });
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const midpoint = Math.floor(bytes.byteLength / 2);
    const chunked = chunkedRequest([bytes.slice(0, midpoint), bytes.slice(midpoint)], {
      "content-type": encoded.headers.get("content-type") ?? "",
    });

    const parsed = await readBoundedFormDataBody(chunked, bytes.byteLength);
    expect(parsed.get("kind")).toBe("cv");
    expect(parsed.get("title")).toBe("Graduate CV");
    expect(parsed.get("file")).toMatchObject({ name: "candidate.pdf", size: 16 });
  });

  it("allows maximum-length document fields with multi-byte UTF-8", async () => {
    const payload = {
      contentText: "界".repeat(60_000),
      jobDescription: "務".repeat(30_000),
      label: "Target version",
      targetCompany: "Example",
      targetJobId: null,
      targetRole: "Developer",
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    expect(bytes.byteLength).toBeGreaterThan(110_000);

    await expect(
      readBoundedJsonBody(
        chunkedRequest([bytes.slice(0, 100_000), bytes.slice(100_000)]),
        careerRequestBodyLimits.documentVersionBytes,
      ),
    ).resolves.toEqual(payload);
  });

  it("allows a maximum-length saved-job description with multi-byte UTF-8", async () => {
    const payload = {
      applyUrl: null,
      companyName: "Example",
      description: "務".repeat(30_000),
      employmentType: null,
      fetchedAt: null,
      location: null,
      provider: "manual",
      providerJobId: null,
      publishedAt: null,
      roleTitle: "Developer",
      sourcePublisher: null,
      sourceUrl: null,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    expect(bytes.byteLength).toBeGreaterThan(45_000);

    await expect(
      readBoundedJsonBody(chunkedRequest([bytes]), careerRequestBodyLimits.jobSaveBytes),
    ).resolves.toEqual(payload);
  });
});
