import { lookup } from "node:dns/promises";
import net from "node:net";

// Webhook URLs are typed in by customers. Refuse ones that point back into
// a private network (localhost, private ranges, cloud metadata), so SealMe
// can't be used to reach machines that aren't on the public internet.
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return isPrivateAddress(mapped[1]);
  return v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("fc") || v6.startsWith("fd");
}

// null when the URL is a public https address; otherwise what's wrong
// with it, worded for the person who typed it.
export async function checkPublicHttpsUrl(raw: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "That isn't a valid URL";
  }
  if (url.protocol !== "https:") return "The URL must start with https://";
  if (url.username || url.password) return "Leave the username and password out of the URL";
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return "That address isn't reachable from the internet";

  let addresses: string[];
  if (net.isIP(host)) addresses = [host];
  else {
    try {
      addresses = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      return "That domain doesn't resolve. Check the spelling";
    }
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) return "That address isn't reachable from the internet";
  return null;
}
