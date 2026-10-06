import { describe, expect, it } from "vitest";
import { contractParty, fillClauses } from "./contract";

describe("contract", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    const clauses = JSON.stringify([{ title: "Parties", body: "Between Agency and {clientName}, starting {startDate}." }]);
    expect(fillClauses(clauses, [{ fieldKey: "clientName", value: "Brightline Software" }, { fieldKey: "startDate", value: null }])[0].body).toBe(
      "Between Agency and Brightline Software, starting {startDate}.",
    );
  });

  it("names the party from the contract, then the client's company, then the person", () => {
    const client = { name: "Priya Shah", company: "Brightline Software" };
    expect(contractParty([{ fieldKey: "clientName", value: "Brightline Software Inc." }], client)).toBe("Brightline Software Inc.");
    expect(contractParty([], client)).toBe("Brightline Software");
    expect(contractParty([{ fieldKey: "clientName", value: " " }], { name: "Mark Ellis", company: null })).toBe("Mark Ellis");
  });
});
