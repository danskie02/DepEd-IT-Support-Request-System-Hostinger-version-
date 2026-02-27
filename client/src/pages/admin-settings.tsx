import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail, Phone, Save, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettings() {
  const { user, isLoadingUser } = useAuth();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setHasChanges(true);
    setSuccessMessage("");
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value);
    setHasChanges(true);
    setSuccessMessage("");
  };

  const validateForm = () => {
    if (!email) {
      toast({
        title: "Validation Error",
        description: "Email is required",
        variant: "destructive",
      });
      return false;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }

    // Phone validation (optional but should be valid format if provided)
    if (phone && !/^\d{10,}$/.test(phone.replace(/[-\s()]/g, ""))) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid phone number (at least 10 digits)",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          phone: phone.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update profile");
      }

      const data = await response.json();

      setSuccessMessage("Profile updated successfully!");
      setHasChanges(false);

      toast({
        title: "Success",
        description: "Your profile has been updated successfully",
      });

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save profile";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingUser) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Unable to load user information</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-gray-900">Admin Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile information</p>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your email and phone number for system notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Username (Read-only) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Username</label>
            <Input
              value={user.username || ""}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-muted-foreground">Your username cannot be changed</p>
          </div>

          {/* Full Name (Read-only) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Full Name</label>
            <Input
              value={user.name || ""}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-muted-foreground">Contact your system administrator to change your name</p>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="admin@deped.gov.ph"
              className="bg-white"
            />
            <p className="text-xs text-muted-foreground">
              Email address is used for system notifications and password recovery
            </p>
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label htmlFor="phone" className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number
            </label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="+63 900 000 0000 or 09000000000"
              className="bg-white"
            />
            <p className="text-xs text-muted-foreground">
              Phone number is used for OTP verification and emergency notifications
            </p>
          </div>

          {/* Information Alert */}
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              These settings will be used for receiving system notifications and OTP codes. Make sure they are correct and accessible.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
            {hasChanges && (
              <Button
                variant="outline"
                onClick={() => {
                  setEmail(user.email || "");
                  setPhone(user.phone || "");
                  setHasChanges(false);
                  setSuccessMessage("");
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Additional Info */}
      <Card className="bg-gray-50/50 border-none">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">When will I receive notifications?</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ New service requests submitted</li>
              <li>✓ High-priority requests need immediate attention</li>
              <li>✓ New user registrations</li>
              <li>✓ System alerts and security notices</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
