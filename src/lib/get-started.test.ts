import { describe, expect, it } from "vitest";
import { getStartedSteps, type GetStartedInput } from "./get-started";

const fresh: GetStartedInput = {
  hasDeal: false,
  hasSentContract: false,
  readyDealId: null,
  prospecting: false,
  hasLeads: false,
  phoneCalls: true,
  hasPhone: false,
  canManageWorkspace: true,
  crmConnected: false,
  canManageTeam: true,
  hasTeammate: false,
};

describe("getStartedSteps", () => {
  it("gives an admin the deal, contract, CRM and team steps", () => {
    expect(getStartedSteps(fresh).map((s) => s.id)).toEqual(["deal", "contract", "crm", "team"]);
  });

  it("adds leads and phone when prospecting is on, and drops what a rep can't do", () => {
    const rep = getStartedSteps({ ...fresh, prospecting: true, canManageWorkspace: false, canManageTeam: false });
    expect(rep.map((s) => s.id)).toEqual(["deal", "contract", "leads", "phone"]);
  });

  it("ticks steps off and sends the contract step to a deal that's ready", () => {
    const steps = getStartedSteps({ ...fresh, hasDeal: true, readyDealId: "d1", hasTeammate: true });
    expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual(["deal", "team"]);
    expect(steps.find((s) => s.id === "contract")).toMatchObject({ href: "/deals/d1/contract", cta: "Open the contract" });
  });
});
