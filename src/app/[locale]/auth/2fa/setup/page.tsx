"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import QRCode from "qrcode";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, ShieldCheck, Copy, Check } from "lucide-react";
import { initiate2FASetup, confirm2FASetup } from "@/actions/auth/two-factor-setup";

type Step = "scan" | "backup";

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const locale = params.locale;

  const [step, setStep] = useState<Step>("scan");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [encryptedSecret, setEncryptedSecret] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    initiate2FASetup().then(async (data) => {
      if ("error" in data) return;
      const url = await QRCode.toDataURL(data.otpauthUrl);
      setQrDataUrl(url);
      setEncryptedSecret(data.encryptedSecret);
    });
  }, []);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!encryptedSecret) return;

    setError(null);
    setIsPending(true);

    try {
      const result = await confirm2FASetup({ encryptedSecret, otp });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if (result.backupCodes) {
        setBackupCodes(result.backupCodes);
        setStep("backup");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  async function copyBackupCodes() {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDone() {
    router.push(`/${locale}/create-org`);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex items-center gap-2 self-center">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="size-5" />
        </div>
        <span className="text-xl font-bold tracking-tight">Veracrew</span>
      </div>

      {step === "scan" && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
              <ShieldCheck className="size-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Set up two-factor auth</CardTitle>
            <CardDescription>
              Scan the QR code with your authenticator app, then enter the 6-digit code.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="2FA QR Code" className="size-48 rounded-md" />
              ) : (
                <div className="flex size-48 items-center justify-center rounded-md bg-muted">
                  <span className="text-sm text-muted-foreground">Loading…</span>
                </div>
              )}
            </div>

            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  maxLength={6}
                  required
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-lg tracking-widest"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={isPending || otp.length !== 6 || !encryptedSecret}
              >
                {isPending ? "Verifying…" : "Verify & continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "backup" && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <ShieldCheck className="size-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">Save your backup codes</CardTitle>
            <CardDescription>
              Store these codes somewhere safe. Each can only be used once if you lose access to your
              authenticator app.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted p-4">
              <div className="grid grid-cols-2 gap-1">
                {backupCodes.map((code) => (
                  <code key={code} className="text-center font-mono text-sm">
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={copyBackupCodes}>
              {copied ? (
                <><Check className="mr-2 size-4" />Copied!</>
              ) : (
                <><Copy className="mr-2 size-4" />Copy codes</>
              )}
            </Button>

            <Button className="w-full" onClick={handleDone}>
              I&apos;ve saved my codes — continue
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
