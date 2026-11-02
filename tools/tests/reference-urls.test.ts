import { expect, test } from "bun:test";
import {
  collectReferenceUrls,
  collectReferenceUrlIssues,
  formatReferenceUrlReport,
} from "../src/reference-urls";

test("reference URL discovery includes legacy fields and preserves entry paths", () => {
  const document = {
    FRD: {
      data: {
        all: {
          "FRD-TST": {
            reference_url: "https://example.com/a",
            referenceurl: "https://example.com/b",
          },
        },
      },
    },
    examples: [{ reference_url: "https://example.com/c" }],
    schema: { url: "https://example.com/ignored" },
    reference_url_web_name: "ignored",
  };
  expect(collectReferenceUrls(document)).toEqual([
    {
      location: "FRD.data.all.FRD-TST.reference_url",
      url: "https://example.com/a",
    },
    {
      location: "FRD.data.all.FRD-TST.referenceurl",
      url: "https://example.com/b",
    },
    { location: "examples[0].reference_url", url: "https://example.com/c" },
  ]);
});

test("references to the same page share a request and retain every failing location", async () => {
  const calls: Array<[string, string | undefined]> = [];
  const issues = await collectReferenceUrlIssues(
    {
      first: { reference_url: "https://example.com/missing#one" },
      second: { referenceurl: "https://example.com/missing#two" },
    },
    {
      fetchUrl: async (url, init) => {
        expect(init.redirect).toBe("follow");
        calls.push([url, init.method]);
        return new Response(null, { status: 404 });
      },
    },
  );
  expect(calls).toEqual([
    ["https://example.com/missing", "HEAD"],
    ["https://example.com/missing", "GET"],
  ]);
  expect(issues.map((issue) => issue.location)).toEqual([
    "first.reference_url",
    "second.referenceurl",
  ]);
  const report = formatReferenceUrlReport(issues);
  expect(report).toContain("Reference URL validation failed with 2 issues:");
  expect(report).toContain("first.reference_url");
  expect(report).toContain("https://example.com/missing#two");
  expect(report).toContain("HTTP 404");
});

test("successful HEAD requests avoid GET; rejected HEAD requests fall back to GET", async () => {
  const methods: string[] = [];
  const issues = await collectReferenceUrlIssues(
    {
      first: { reference_url: "https://example.com/ok" },
      second: { reference_url: "https://example.com/no-head" },
    },
    {
      fetchUrl: async (url, init) => {
        methods.push(`${url} ${init.method}`);
        return new Response(null, {
          status: url.endsWith("no-head") && init.method === "HEAD" ? 405 : 200,
        });
      },
    },
  );
  expect(issues).toEqual([]);
  expect(methods).toHaveLength(3);
  expect(methods).not.toContain("https://example.com/ok GET");
  expect(methods).toContain("https://example.com/no-head GET");
});

test("blocked access, server failures, and network errors are explicit verification failures", async () => {
  const issues = await collectReferenceUrlIssues(
    {
      denied: { reference_url: "https://example.com/403" },
      limited: { reference_url: "https://example.com/429" },
      server: { reference_url: "https://example.com/500" },
      network: { reference_url: "https://example.com/network" },
    },
    {
      fetchUrl: async (url) => {
        if (url.endsWith("network")) throw new Error("DNS unavailable");
        return new Response(null, { status: Number(url.split("/").at(-1)) });
      },
    },
  );
  expect(issues).toHaveLength(4);
  expect(issues[0]!.message).toContain("HTTP 403: access denied");
  expect(issues[1]!.message).toContain("HTTP 429: rate limited");
  expect(issues[2]!.message).toContain("HTTP 500");
  expect(issues[3]!.message).toContain("DNS unavailable");
});

test("invalid and non-HTTP references are reported without requesting them", async () => {
  const issues = await collectReferenceUrlIssues(
    {
      invalid: { reference_url: "not a URL" },
      unsupported: { reference_url: "file:///tmp/example" },
    },
    {
      fetchUrl: async () => {
        throw new Error("Unexpected request");
      },
    },
  );
  expect(issues[0]!.message).toContain("Invalid absolute reference URL");
  expect(issues[1]!.message).toContain(
    "Unsupported reference URL protocol file:",
  );
});

test("a stalled request is bounded by its timeout", async () => {
  const issues = await collectReferenceUrlIssues(
    { reference_url: "https://example.com/slow" },
    {
      timeoutMs: 10,
      fetchUrl: async (_, init) =>
        new Promise<Response>((_, reject) => {
          init.signal!.addEventListener(
            "abort",
            () => reject(init.signal!.reason),
            { once: true },
          );
        }),
    },
  );
  expect(issues).toHaveLength(1);
  expect(issues[0]!.message).toContain("Timed out after 10 ms");
});

test("reference checks bound concurrency to four requests", async () => {
  let active = 0;
  let peak = 0;
  const document = Array.from({ length: 9 }, (_, i) => ({
    reference_url: `https://example.com/${i}`,
  }));
  const issues = await collectReferenceUrlIssues(document, {
    fetchUrl: async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return new Response(null, { status: 200 });
    },
  });
  expect(issues).toEqual([]);
  expect(peak).toBe(4);
});
