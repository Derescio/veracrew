import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

import { sendEmail } from "./resend";

describe("sendEmail", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("resolves without error when Resend responds successfully", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "email-1" }, error: null });
    await expect(
      sendEmail({ to: "user@example.com", subject: "Hello", html: "<p>Hi</p>" })
    ).resolves.toBeUndefined();
  });

  it("throws when Resend returns an error object", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { message: "API error", name: "validation_error" },
    });
    await expect(
      sendEmail({ to: "user@example.com", subject: "Hello", html: "<p>Hi</p>" })
    ).rejects.toThrow("Resend error: API error");
  });
});
