import crypto from "crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("next/server", () => ({ after: () => { throw new Error("outside request"); } }));

import { verifyHubspotSignature } from "./hubspot-leads";
import { leadIdsFromOutboundMessage, OUTBOUND_MESSAGE_ACK } from "./salesforce-leads";

describe("Salesforce outbound messages", () => {
  const note = (inner: string) => `<Notification><Id>04lWV00000AAAAAAAA</Id>${inner}</Notification>`;
  const lead = (id: string) => note(`<sObject xsi:type="sf:Lead" xmlns:sf="urn:sobject.enterprise.soap.sforce.com"><sf:Id>${id}</sf:Id></sObject>`);
  const wrap = (body: string) => `<?xml version="1.0"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><notifications xmlns="http://soap.sforce.com/2005/09/outbound"><OrganizationId>00D000000000001AAA</OrganizationId>${body}</notifications></soapenv:Body></soapenv:Envelope>`;

  it("reads Lead ids, 15 or 18 characters, once each", () => {
    expect(leadIdsFromOutboundMessage(wrap(lead("00QWV00000CZjEf2AL") + lead("00QWV00000CZjEf") + lead("00QWV00000CZjEf2AL")))).toEqual(["00QWV00000CZjEf2AL", "00QWV00000CZjEf"]);
  });
  it("ignores notification ids, other objects and junk", () => {
    const contact = note(`<sObject xsi:type="sf:Contact"><sf:Id>003WV00000ZZZZZZZZ</sf:Id></sObject>`);
    expect(leadIdsFromOutboundMessage(wrap(contact))).toEqual([]);
    expect(leadIdsFromOutboundMessage("garbage")).toEqual([]);
    expect(leadIdsFromOutboundMessage(wrap(lead("00Q'; DROP TABLE x"))) ).toEqual([]);
  });
  it("acknowledges the way Salesforce expects", () => {
    expect(OUTBOUND_MESSAGE_ACK).toContain("<Ack>true</Ack>");
    expect(OUTBOUND_MESSAGE_ACK).toContain("http://soap.sforce.com/2005/09/outbound");
  });
});

describe("HubSpot webhook signatures", () => {
  const secret = "test-client-secret-1234567890";
  const url = "https://app.sealme.net/api/hubspot/webhook";
  const body = JSON.stringify([{ portalId: 1, objectId: 2, subscriptionType: "contact.creation" }]);

  it("accepts a fresh v3 signature and rejects a tampered or stale one", () => {
    const ts = String(Date.now());
    const sig = crypto.createHmac("sha256", secret).update(`POST${url}${body}${ts}`).digest("base64");
    const headers = (s: string, t: string) => new Headers({ "x-hubspot-signature-v3": s, "x-hubspot-request-timestamp": t });
    expect(verifyHubspotSignature({ secret, method: "POST", url, body, headers: headers(sig, ts) })).toBe(true);
    expect(verifyHubspotSignature({ secret, method: "POST", url, body: body + " ", headers: headers(sig, ts) })).toBe(false);
    expect(verifyHubspotSignature({ secret: "wrong", method: "POST", url, body, headers: headers(sig, ts) })).toBe(false);
    const old = String(Date.now() - 10 * 60_000);
    const oldSig = crypto.createHmac("sha256", secret).update(`POST${url}${body}${old}`).digest("base64");
    expect(verifyHubspotSignature({ secret, method: "POST", url, body, headers: headers(oldSig, old) })).toBe(false);
  });

  it("accepts the older v1 and v2 hashes", () => {
    const v1 = crypto.createHash("sha256").update(`${secret}${body}`).digest("hex");
    expect(verifyHubspotSignature({ secret, method: "POST", url, body, headers: new Headers({ "x-hubspot-signature": v1 }) })).toBe(true);
    const v2 = crypto.createHash("sha256").update(`${secret}POST${url}${body}`).digest("hex");
    expect(verifyHubspotSignature({ secret, method: "POST", url, body, headers: new Headers({ "x-hubspot-signature": v2, "x-hubspot-signature-version": "v2" }) })).toBe(true);
    expect(verifyHubspotSignature({ secret, method: "POST", url, body, headers: new Headers() })).toBe(false);
  });
});
