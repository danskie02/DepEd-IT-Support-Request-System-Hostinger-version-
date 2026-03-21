import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const userLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type UserLoginSchema = z.infer<typeof userLoginSchema>;

export default function UserLoginPage() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<UserLoginSchema>({
    resolver: zodResolver(userLoginSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: UserLoginSchema) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/user-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const error = await res.json();
        if (res.status === 401) {
          toast({
            title: "Email Not Found",
            description: error.message || "Please check your email or submit a new request.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login Failed",
            description: error.message || "An error occurred",
            variant: "destructive",
          });
        }
        return;
      }

      const data = await res.json();
      toast({
        title: "Verification Code Sent",
        description: "Check your email and phone for the OTP code.",
      });
      setLocation(`/verify-otp?userId=${data.userId}&userLogin=true`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      {/* DepEd Branding Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img 
            src="/DepEdMdq_logo.jfif"
            alt="DepEd Logo" 
            className="h-24 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div>
            <h1 className="text-3xl font-display font-bold text-primary">DepEd Marinduque IT Services</h1>
            <p className="text-muted-foreground">Check Your Request Status</p>
          </div>
        </div>
      </div>

      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-blue-400">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-2xl font-bold">Access Your Requests</CardTitle>
          </div>
          <CardDescription>
            Enter the email you used to submit your request
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="your.email@deped.gov.ph"
                        {...field}
                        className="bg-white"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Verification Code"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground text-center">
            <p>A 6-digit verification code will be sent to your email and phone.</p>
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLocation("/new-request")}
              disabled={isLoading}
            >
              New Request
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLocation("/login")}
              disabled={isLoading}
            >
              Admin Login
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Info Banner */}
      <div className="mt-8 max-w-md text-center">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            <strong>Returning User?</strong> Log in with the email you used to submit your request to check its status.
          </p>
        </div>
      </div>
    </div>
  );
}
