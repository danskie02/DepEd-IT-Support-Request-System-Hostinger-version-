import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertCircle } from "lucide-react";

interface UserContactInfo {
  email: string;
  phone: string;
  name: string;
}

export default function VerifyOtpPage() {
  const [, setLocation] = useLocation();
  const { verifyOtp, isVerifying, user } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [contactInfo, setContactInfo] = useState<UserContactInfo | null>(null);
  const [isLoadingContact, setIsLoadingContact] = useState(false);

  // Extract userId from query params
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("userId");

  // Fetch user contact info when component loads
  useEffect(() => {
    if (userId) {
      setIsLoadingContact(true);
      fetch(`/api/auth/contact-info/${userId}`)
        .then((res) => {
          if (res.ok) {
            return res.json();
          }
          throw new Error("Failed to fetch contact info");
        })
        .then((data) => setContactInfo(data))
        .catch((err) => {
          console.error("Error fetching contact info:", err);
          // Don't show error to user, just continue
        })
        .finally(() => setIsLoadingContact(false));
    }
  }, [userId]);

  // If user is already verified and logged in, redirect them
  useEffect(() => {
    if (user && user.isVerified) {
      if (user.role === 'admin') {
        setLocation("/admin/dashboard");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [user, setLocation]);

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6 && !isVerifying) {
      handleVerify();
    }
  };

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">Invalid session. Please submit a request again.</p>
            <Button onClick={() => setLocation("/new-request")}>Go to Request Form</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleVerify = () => {
    setError(null);
    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }
    verifyOtp(
      { userId: parseInt(userId), code },
      {
        onError: (err: Error) => {
          setError(err.message || "Invalid or expired OTP code. Please try again.");
        }
      }
    );
  };

  // Format phone number for display (mask middle digits if desired)
  const formatPhoneForDisplay = (phone: string) => {
    // Remove non-digits for phone formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      // Format as 09XX XXX XXXX
      return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
    } else if (cleaned.length === 10) {
      // Format as 9XX XXX XXXX
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
    }
    return phone;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-yellow-400">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-yellow-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold">Verify Your Identity</CardTitle>
          <CardDescription className="mt-2">
            {isLoadingContact ? (
              <span className="text-muted-foreground">Loading contact information...</span>
            ) : contactInfo ? (
              <span className="text-sm">
                Check your Email: <strong>{contactInfo.email}</strong> and SMS: <strong>{formatPhoneForDisplay(contactInfo.phone)}</strong> for the OTP code
              </span>
            ) : (
              <span>Enter the 6-digit code sent to your email and phone.</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Input 
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError(null);
              }}
              onKeyPress={handleKeyPress}
              placeholder="000000"
              className="text-center text-3xl tracking-[1em] font-mono h-16"
              maxLength={6}
              autoFocus
            />
            <p className="text-xs text-center text-muted-foreground">
              Enter the 6-digit verification code
            </p>
          </div>
          
          <Button 
            onClick={handleVerify} 
            className="w-full h-12 text-lg font-bold" 
            disabled={isVerifying || code.length !== 6}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => setLocation("/new-request")}
          >
            Back to request form
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            If your code expired or your contact details were wrong, start again from the form — your previous attempt may need a new submission.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
