import { beforeEach, describe, expect, it, vi } from "vitest";

const { contract, contractSigner, envelopeStatus, finalize } = vi.hoisted(() => ({
  contract: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  contractSigner: { updateMany: vi.fn() },
  envelopeStatus: vi.fn(),
  finalize: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { contract, contractSigner } }));
vi.mock("@/lib/docusign", () => ({ docusignEnvelopeStatus: envelopeStatus }));
vi.mock("@/lib/signing", () => ({ finalizeContractSigned: finalize }));
vi.mock("@/lib/error-report", () => ({ reportError: async () => {} }));

import { syncDocusignContract } from "./docusign-sync";

describe("DocuSign contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contract.findUnique.mockResolvedValue({ id: "c1", status: "sent", docusignEnvelopeId: "env-1", deal: { workspaceId: "w1" } });
  });

  it("stays unsigned until DocuSign itself says the envelope is completed", async () => {
    envelopeStatus.mockResolvedValue({ status: "sent", signers: [] });
    expect(await syncDocusignContract("c1")).toBe(false);
    expect(envelopeStatus).toHaveBeenCalledWith("w1", "env-1");
    expect(finalize).not.toHaveBeenCalled();
  });

  it("marks it signed with the client's name from DocuSign", async () => {
    envelopeStatus.mockResolvedValue({
      status: "completed",
      signers: [
        { name: "Second Signer", email: "b@x.test", routingOrder: "2", status: "completed" },
        { name: "Priya Shah", email: "a@x.test", routingOrder: "1", status: "completed", signedDateTime: "2026-10-06T15:00:00Z" },
      ],
    });
    expect(await syncDocusignContract("c1")).toBe(true);
    expect(contract.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { signerName: "Priya Shah", signedAt: new Date("2026-10-06T15:00:00Z") } });
    expect(finalize).toHaveBeenCalledWith("c1");
  });

  it("doesn't ask DocuSign about a contract that's already signed", async () => {
    contract.findUnique.mockResolvedValue({ id: "c1", status: "signed", docusignEnvelopeId: "env-1", deal: { workspaceId: "w1" } });
    expect(await syncDocusignContract("c1")).toBe(true);
    expect(envelopeStatus).not.toHaveBeenCalled();
  });
});
