// Made-up people: the demo reps in a workspace (@example.com) and the
// disposable test accounts (@example.test). Left out of the admin numbers
// and the sign-up emails, so both are about real people only.
const TEST_DOMAINS = ["@example.com", "@example.test"];

export function isTestEmail(email: string): boolean {
  return TEST_DOMAINS.some((d) => email.toLowerCase().endsWith(d));
}

// For a Prisma `NOT`: users whose email is one of the made-up ones.
export const NOT_TEST_EMAIL = TEST_DOMAINS.map((d) => ({ email: { endsWith: d } }));
