import { Resend } from "resend";

export type SenderDomainRecord = {
  record: string;
  type: string;
  name: string;
  value: string;
  status: string;
  priority?: number;
};

export type SenderDomainStatus = {
  status: string;
  records: SenderDomainRecord[];
};

function client() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function createSenderDomain(domain: string): Promise<{ id: string } & SenderDomainStatus> {
  const { data, error } = await client().domains.create({ name: domain });
  if (error || !data) throw new Error(error?.message ?? "Couldn't create the domain");
  return { id: data.id, status: data.status, records: data.records as SenderDomainRecord[] };
}

export async function getSenderDomainStatus(domainId: string): Promise<SenderDomainStatus> {
  const { data, error } = await client().domains.get(domainId);
  if (error || !data) throw new Error(error?.message ?? "Couldn't look up the domain");
  return { status: data.status, records: data.records as SenderDomainRecord[] };
}

export async function verifySenderDomain(domainId: string): Promise<void> {
  const { error } = await client().domains.verify(domainId);
  if (error) throw new Error(error.message);
}

export async function removeSenderDomain(domainId: string): Promise<void> {
  await client().domains.remove(domainId);
}
