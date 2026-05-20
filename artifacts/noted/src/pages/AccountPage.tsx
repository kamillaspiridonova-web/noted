import { useState } from "react";
import { UserProfile, useUser } from "@clerk/react";
import { Sidebar } from "@/components/Sidebar";
import { User, Star, Trash2, Loader2, Mail, KeyRound, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const IS_DEV_BUILD = import.meta.env.DEV;

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-10"
          autoComplete="off"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const { user, isLoaded } = useUser();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isLoaded || !user || !user.passwordEnabled) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: false });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg =
        (err as { errors?: Array<{ message: string }> })?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : "Failed to update password");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border rounded-2xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Change password</h2>
      </div>
      <form onSubmit={handleSave} className="px-5 py-5 space-y-4">
        <PasswordField
          id="current-password"
          label="Current password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Enter your current password"
          disabled={saving}
        />
        <PasswordField
          id="new-password"
          label="New password"
          value={newPassword}
          onChange={setNewPassword}
          placeholder="Enter new password"
          disabled={saving}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Re-enter new password"
          disabled={saving}
        />
        <div className="flex justify-end pt-1">
          <Button type="submit" size="sm" disabled={saving || !currentPassword || !newPassword || !confirmPassword}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function EmailsSection() {
  const { user, isLoaded } = useUser();
  const [makingPrimary, setMakingPrimary] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isLoaded || !user) return null;

  const emails = user.emailAddresses;
  const primaryId = user.primaryEmailAddressId;

  const handleMakePrimary = async (emailId: string) => {
    setMakingPrimary(emailId);
    try {
      await user.update({ primaryEmailAddressId: emailId });
      await user.reload();
      toast.success("Primary email updated");
    } catch {
      toast.error("Failed to update primary email");
    } finally {
      setMakingPrimary(null);
    }
  };

  const handleDelete = async (emailId: string) => {
    setDeleting(emailId);
    setConfirmDeleteId(null);
    try {
      const addr = emails.find((e) => e.id === emailId);
      if (addr) {
        await addr.destroy();
        await user.reload();
        toast.success("Email address removed");
      }
    } catch {
      toast.error("Failed to remove email address");
    } finally {
      setDeleting(null);
    }
  };

  const confirmTarget = emails.find((e) => e.id === confirmDeleteId);

  return (
    <>
      <div className="border border-border rounded-2xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Email addresses</h2>
        </div>

        <div className="divide-y divide-border">
          {emails.map((email) => {
            const isPrimary = email.id === primaryId;
            const isVerified = email.verification?.status === "verified";
            const isBusy = makingPrimary === email.id || deleting === email.id;

            return (
              <div key={email.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{email.emailAddress}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isPrimary && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0 font-medium">
                        Primary
                      </Badge>
                    )}
                    {!isVerified && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 font-medium text-amber-600 border-amber-300 bg-amber-50"
                      >
                        Unverified
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!isPrimary && isVerified && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleMakePrimary(email.id)}
                      disabled={isBusy}
                    >
                      {makingPrimary === email.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Star className="w-3 h-3" />
                      )}
                      Make primary
                    </Button>
                  )}
                  {!isPrimary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setConfirmDeleteId(email.id)}
                      disabled={isBusy}
                    >
                      {deleting === email.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {emails.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No email addresses on file.
          </div>
        )}
      </div>

      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove email address?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmTarget?.emailAddress}</strong> will be permanently
              removed from your account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function AccountPage() {
  if (IS_DEV_BUILD) {
    return (
      <div className="flex h-dvh w-full bg-background overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col items-center justify-center pt-14 md:pt-0 text-muted-foreground gap-3">
          <User className="w-10 h-10 opacity-30" />
          <p className="text-sm">Account settings are available in the published app.</p>
          <Link
            href="/"
            className="text-sm underline underline-offset-2 hover:text-foreground transition-colors"
          >
            ← Back to home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-xl font-semibold mb-6">Account</h1>

          <section className="mb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
              Profile details
            </h2>
            <EmailsSection />
            <ChangePasswordSection />
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
              Profile &amp; Security
            </h2>
            <UserProfile
              routing="hash"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox:
                    "w-full shadow-none border border-border rounded-2xl overflow-hidden",
                  card: "!shadow-none !border-0 !rounded-none",
                  navbar: "border-r border-border",
                  navbarButton: "text-foreground",
                  pageScrollBox: "p-6",
                },
              }}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
