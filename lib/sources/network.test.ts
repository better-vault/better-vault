import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateAddress } from "./network";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "not-an-ip",
  ])("refuses %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"])("allows %s", (address) => {
    expect(isPrivateAddress(address)).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("refuses other protocols", async () => {
    await expect(assertPublicUrl(new URL("file:///etc/passwd"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("ftp://example.com"))).rejects.toThrow();
  });

  it("refuses private hosts given as IPs", async () => {
    await expect(assertPublicUrl(new URL("http://127.0.0.1:3000"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("http://[::1]/"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("http://169.254.169.254/latest"))).rejects.toThrow();
  });

  it("refuses credentials in the address", async () => {
    await expect(assertPublicUrl(new URL("https://user:pass@8.8.8.8/"))).rejects.toThrow();
  });
});
