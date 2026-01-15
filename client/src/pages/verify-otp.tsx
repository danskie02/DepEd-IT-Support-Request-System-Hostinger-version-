import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

export default function VerifyOtpPage() {
  const [location] = useLocation();
  const { verifyOtp, isVerifying } = useAuth();
  const [code, setCode] = useState("");

  // Extract userId from query params
  const params = new URLSearchParams(window.location.search);
  const userId = params.get("userId");

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-red-500 mb-4">Invalid session. Please login again.</p>
            <Button onClick={() => window.location.href = "/login"}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleVerify = () => {
    verifyOtp({ userId: parseInt(userId), code });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-yellow-400">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-yellow-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-yellow-600">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl font-bold">Verify Identity</CardTitle>
          <CardDescription>
            Enter the 6-digit code sent to your registered contact.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="space-y-2">
            <Input 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="text-center text-3xl tracking-[1em] font-mono h-16"
              maxLength={6}
            />
            <p className="text-xs text-center text-muted-foreground">
              Hint: Use '123456' for demo purposes
            </p>
          </div>
          
          <Button 
            onClick={handleVerify} 
            className="w-full h-12 text-lg font-bold" 
            disabled={isVerifying || code.length < 6}
          >
            {isVerifying ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Verify Code"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
