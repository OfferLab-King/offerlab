import type { SyntheticCatalogTarget, SyntheticCatalogPreserve } from "./synthetic-catalog-cleanup";

/**
 * Exact allow-list of synthetic integration-test fixture companies discovered
 * in the persistent local catalogue on 2026-08-12.
 *
 * Every row was confirmed during a read-only inventory: all of these
 * companies use reserved .example.com careers URLs, carry the deterministic
 * integration-test slug suffixes, and no real employer is present. Deletion
 * is refused unless every allow-listed ID still matches its expected name and
 * slug, no targeted job is saved by a member, and the database is loopback.
 *
 * The two RLS Test Co companies whose jobs are referenced by
 * app.user_saved_job are deliberately NOT allow-listed; they are preserved
 * with their member saves intact.
 */
export const syntheticCatalogTargets: readonly SyntheticCatalogTarget[] = [
  {
    id: "c53b9322-b7e2-48b0-893e-93b586960141",
    expectedName: "Admin Source Co",
    expectedSlug: "admin-source-co-msqd5z0f-r1j47j",
  },
  {
    id: "9c837af4-f836-49a1-8e3a-0910541f90ae",
    expectedName: "Admin Source Co",
    expectedSlug: "admin-source-co-msqd4t6f-2fxe0n",
  },
  {
    id: "c7bab9b6-acc1-4abe-8429-e2fa9df96d49",
    expectedName: "Allowed Co",
    expectedSlug: "allowed-co-msqd4tmw-9bisym",
  },
  {
    id: "9650c97b-6bb6-44cb-9ad1-020060c28499",
    expectedName: "Allowed Co",
    expectedSlug: "allowed-co-msqd5zav-t67lez",
  },
  {
    id: "ad0a5093-0c04-4957-ba34-d3066f306b81",
    expectedName: "Audit Test Co",
    expectedSlug: "audit-test-co-msqd5z9c-t0j74c",
  },
  {
    id: "7822dc68-29b5-442b-a8a1-e4e862940e09",
    expectedName: "Audit Test Co",
    expectedSlug: "audit-test-co-msqd4tkk-5f5t3m",
  },
  {
    id: "4889f010-d78c-4b49-9c4f-e6cd897cbdaa",
    expectedName: "Blank SEO Co",
    expectedSlug: "seo-blank-msqd4tnc-u94azg",
  },
  {
    id: "3d2d535d-a0d0-4f8e-ae1d-8dad097217ed",
    expectedName: "Blank SEO Co",
    expectedSlug: "seo-blank-msqd5zb6-a3waoo",
  },
  {
    id: "7f31c720-f235-43f7-868d-cd93fb610b90",
    expectedName: "Blocked Co",
    expectedSlug: "blocked-co-msqd5zan-w90vn5",
  },
  {
    id: "1190b76e-f989-48e1-8863-59efcda67af9",
    expectedName: "Blocked Co",
    expectedSlug: "blocked-co-msqd4tmm-qyesss",
  },
  {
    id: "865a085d-70f7-495f-a973-157cd9c8b1f0",
    expectedName: "Crawler Co",
    expectedSlug: "crawler-co-msqd4t5x-uct8m1",
  },
  {
    id: "c501c920-bc1c-43c9-8903-7e40b1f9fe35",
    expectedName: "Crawler Co",
    expectedSlug: "crawler-co-msqd5yzt-zvk7ei",
  },
  {
    id: "0dbd66d1-e587-40db-b09f-471de956458e",
    expectedName: "Cycle Test Co",
    expectedSlug: "cycle-test-co-msqd5z1s-4ggjg0",
  },
  {
    id: "fcbf62e6-2daf-41ea-86bd-1389c1f886d0",
    expectedName: "Cycle Test Co",
    expectedSlug: "cycle-test-co-msqd4t7z-s7qu53",
  },
  {
    id: "609c1db0-03b7-449c-8536-831f2d9b327a",
    expectedName: "Described SEO Co",
    expectedSlug: "seo-described-msqd5zbe-ajnxwu",
  },
  {
    id: "8102e579-dd50-4143-a88b-ea6d93eea989",
    expectedName: "Described SEO Co",
    expectedSlug: "seo-described-msqd4tnn-c7gs7e",
  },
  {
    id: "0351829d-22ef-458c-a51c-9e84fc51b687",
    expectedName: "Detail Test Co",
    expectedSlug: "detail-test-co-msqd55lp-xbiuun",
  },
  {
    id: "7a5749dc-537c-42b1-90e0-2ead83ba5535",
    expectedName: "Detail Test Co",
    expectedSlug: "detail-test-co-msqd66eg-0caa2d",
  },
  {
    id: "46fb3ebe-0acb-43a9-891b-f8a46643740a",
    expectedName: "Facet Test Co",
    expectedSlug: "facet-test-co-msqd4tyv-vdesi7",
  },
  {
    id: "01bca3c7-95e7-461c-ac98-31f131e76ded",
    expectedName: "Facet Test Co",
    expectedSlug: "facet-test-co-msqd4u0n-zprpil",
  },
  {
    id: "1da05600-6806-4a42-bb0a-77a8455eab35",
    expectedName: "Facet Test Co",
    expectedSlug: "facet-test-co-msqd5zji-l1afd8",
  },
  {
    id: "9c3d13f2-0b81-4eda-b5a9-f52bde1dfa8b",
    expectedName: "Facet Test Co",
    expectedSlug: "facet-test-co-msqd5znn-7fla85",
  },
  {
    id: "39fa89cf-d9ec-4c2d-be25-53948103a702",
    expectedName: "Facet Test Co",
    expectedSlug: "facet-test-co-msqd5zdk-oicf8d",
  },
  {
    id: "7b58f030-82fd-43ed-9f37-7054e4ff107b",
    expectedName: "Facet Test Co",
    expectedSlug: "facet-test-co-msqd5zm4-cq691q",
  },
  {
    id: "8c3a5ecb-8d19-4128-806c-d82456eca6c1",
    expectedName: "Facet Test Co",
    expectedSlug: "facet-test-co-msqd4tpw-qbof59",
  },
  {
    id: "0f8512c3-820e-4459-95a2-44a9855f5868",
    expectedName: "Facet Test Co",
    expectedSlug: "facet-test-co-msqd4tvy-b7tyji",
  },
  {
    id: "a414ae14-af40-4dac-aa62-005071c7c0ac",
    expectedName: "Historical SEO Co",
    expectedSlug: "seo-historical-msqd5zc7-xjwcgc",
  },
  {
    id: "0b133d46-137d-46c7-bdc3-4d3a2cdb3a88",
    expectedName: "Historical SEO Co",
    expectedSlug: "seo-historical-msqd4tok-qg0jec",
  },
  {
    id: "81ad1cd6-e145-40b7-a318-af9195494b5a",
    expectedName: "IA Test Co",
    expectedSlug: "ia-test-co-msqd5z6y-h7ksud",
  },
  {
    id: "e444788c-8e0f-4119-b73c-96926081cab1",
    expectedName: "IA Test Co",
    expectedSlug: "ia-test-co-msqd4tgq-3b0o9n",
  },
  {
    id: "9f35b68d-5499-4748-9956-970572dd71f6",
    expectedName: "Inactive SEO Co",
    expectedSlug: "seo-inactive-msqd5zbs-f0tsa1",
  },
  {
    id: "f7f2ff1e-0696-47cb-b761-e96590e3bdfd",
    expectedName: "Inactive SEO Co",
    expectedSlug: "seo-inactive-msqd4to5-cqmwpo",
  },
  {
    id: "d8323800-ef08-41a5-8992-d85cfcb5f622",
    expectedName: "Multi Source Co",
    expectedSlug: "multi-source-co-msqd4t2a-fb65vt",
  },
  {
    id: "c003f21e-94aa-43d6-869d-26d82f679cb0",
    expectedName: "Multi Source Co",
    expectedSlug: "multi-source-co-msqd5yv0-76n11e",
  },
  {
    id: "05ad0cdb-d7b7-4726-ad3e-4925371ed351",
    expectedName: "Parity Test Co",
    expectedSlug: "parity-test-co-msqd55jo-xld79h",
  },
  {
    id: "d29315a1-ff3c-4312-be4d-a8842eb17a55",
    expectedName: "Parity Test Co",
    expectedSlug: "parity-test-co-msqd66ch-s5qomn",
  },
  {
    id: "2bd278e2-0508-411b-8fcb-4e4d836854e6",
    expectedName: "Pub Test Co",
    expectedSlug: "pub-test-co-msqd5z7m-1j8u2y",
  },
  {
    id: "953c2a6d-0531-448f-ad66-23c5b536dda3",
    expectedName: "Pub Test Co",
    expectedSlug: "pub-test-co-msqd4tho-ltrnjy",
  },
  {
    id: "8db0d483-2865-4a06-9a1f-7e27a00042ac",
    expectedName: "Related A Co",
    expectedSlug: "related-a-msqd66f5-d6j25s",
  },
  {
    id: "f136d2e6-b05b-4e28-a612-535391ff1f2a",
    expectedName: "Related A Co",
    expectedSlug: "related-a-msqd55r2-9entyr",
  },
  {
    id: "fdba2b28-b262-4569-9e3a-4f95409c11f1",
    expectedName: "Related A Co",
    expectedSlug: "related-a-msqd55o5-yw0vca",
  },
  {
    id: "e222de40-0e17-4b8a-8c91-a3ee2a17dc7a",
    expectedName: "Related A Co",
    expectedSlug: "related-a-msqd55mh-g8j96p",
  },
  {
    id: "afd73122-0eef-470b-8176-eec70f105ea2",
    expectedName: "Related A Co",
    expectedSlug: "related-a-msqd66ju-3qwyfj",
  },
  {
    id: "a5220ee6-bf27-4014-8b44-e2e6f2df1864",
    expectedName: "Related A Co",
    expectedSlug: "related-a-msqd66gu-ldponq",
  },
  {
    id: "66e65907-ca16-472f-9942-8df298f78c4e",
    expectedName: "Related B Co",
    expectedSlug: "related-b-msqd55r9-i5by74",
  },
  {
    id: "68704f5f-ea1b-4dc0-b2e5-6e90500fca6a",
    expectedName: "Related B Co",
    expectedSlug: "related-b-msqd66fd-5978fn",
  },
  {
    id: "ed91d222-cfce-45da-966c-a293f1ec1ff4",
    expectedName: "Related B Co",
    expectedSlug: "related-b-msqd55od-21mnqm",
  },
  {
    id: "a8d38e04-ed43-4b0e-99e7-807f904438c5",
    expectedName: "Related B Co",
    expectedSlug: "related-b-msqd66k1-g8xak2",
  },
  {
    id: "12b70506-9720-45c7-8a50-cfe7c2f0221a",
    expectedName: "Related B Co",
    expectedSlug: "related-b-msqd55mp-5h7fh2",
  },
  {
    id: "ce8e3c67-a1a1-4092-a7de-288c78b7a95b",
    expectedName: "Related B Co",
    expectedSlug: "related-b-msqd66h1-lmawa2",
  },
  {
    id: "4ed9992a-c0fe-4b8b-9602-4745d05f3e22",
    expectedName: "Review Test Co",
    expectedSlug: "review-test-co-msqd4tjm-5kntsb",
  },
  {
    id: "5c4b3794-4369-4bf2-aec1-4f1d47999c1a",
    expectedName: "Review Test Co",
    expectedSlug: "review-test-co-msqd5z8p-590ppp",
  },
  {
    id: "e91aebdd-bfba-43f7-83a0-c0ffddc3d574",
    expectedName: "Source Isolation Co",
    expectedSlug: "source-isolation-co-msqd4tdb-do3myn",
  },
  {
    id: "7981aa46-81bd-4b95-8d29-90c316f297da",
    expectedName: "Source Isolation Co",
    expectedSlug: "source-isolation-co-msqd5z4l-vu1mdd",
  },
];

export const preservedSyntheticCompanies: readonly SyntheticCatalogPreserve[] = [
  {
    id: "d5f7911c-9d5b-4b11-8946-b4ff9eb48a57",
    reason:
      "RLS Test Co job saved by member-one@test.offerlab.invalid; deletion refused while saved",
  },
  {
    id: "d0af4219-0b89-48e0-a1a4-206af4f5ea1a",
    reason:
      "RLS Test Co job saved by member-one@test.offerlab.invalid; deletion refused while saved",
  },
];
