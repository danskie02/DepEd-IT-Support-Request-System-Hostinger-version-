import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRequestSchema } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Send, CheckCircle, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import { z } from "zod";

const OFFICE_OPTIONS = [
  "HR",
  "SDS",
  "ASDS",
  "SGOD",
  "CID",
  "Records",
  "Medical Unit",
  "Legal Unit",
  "Accounting Unit",
  "Cashier",
  "Supply Unit",
  "ICT",
  "Auditing Unit",
] as const;

const personalInfoSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email("Valid email required"),
  locationType: z.literal("sdo").or(z.literal("school")),
  office: z.string().min(1, "Office or School name is required"),
});

type PersonalInfo = z.infer<typeof personalInfoSchema>;
type RequestFormValues = z.infer<typeof insertRequestSchema>;

export default function NewRequestPage() {
  const { user, isLoadingUser } = useAuth();
  const { mutate: createRequest, isPending } = useCreateRequest();
  const [, setLocation] = useLocation();

  const [step, setStep] = useState<"request-details" | "personal-info" | "submit">("request-details");
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
  const [savePersonalInfo, setSavePersonalInfo] = useState(true);
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [pendingRequest, setPendingRequest] = useState<RequestFormValues | null>(null);
  const [requestLocationType, setRequestLocationType] = useState<"sdo" | "school">("sdo");

  const personalForm = useForm({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      locationType: "sdo",
      office: "HR",
    },
  });

  const requestForm = useForm({
    resolver: zodResolver(insertRequestSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "Hardware",
      priority: "medium",
      office: "HR",
    },
  });

  useEffect(() => {
    const office = personalInfo?.office;
    if (office) {
      requestForm.setValue("office", office);
      // Set locationType based on whether office is in OFFICE_OPTIONS
      const isSDO = OFFICE_OPTIONS.includes(office as any);
      setRequestLocationType(isSDO ? "sdo" : "school");
    }
  }, [personalInfo, requestForm]);

  useEffect(() => {
    if (step === "personal-info" && pendingRequest) {
      personalForm.setValue("office", pendingRequest.office);
    }
  }, [step, pendingRequest, personalForm]);

  useEffect(() => {
    if (!isLoadingUser) {
      if (user) {
        setPersonalInfo({
          name: user.name,
          phone: user.phone,
          email: user.email,
          locationType: "sdo",
          office: "HR",
        });
        setStep("request-details");
      } else {
        const savedInfo = localStorage.getItem("deped_personal_info");
        if (savedInfo) {
          try {
            const parsed = JSON.parse(savedInfo) as PersonalInfo;
            setPersonalInfo(parsed);
            personalForm.reset(parsed);
          } catch {
            setPersonalInfo(null);
          }
        }
        setStep("request-details");
      }
      setIsCheckingUser(false);
    }
  }, [user, isLoadingUser, personalForm]);

  const submitPayload = (values: RequestFormValues, info: PersonalInfo | null) => {
    const submissionData = {
      ...values,
      personalInfo: user ? undefined : info ?? undefined,
    };

    setStep("submit");

    createRequest(submissionData, {
      onSuccess: (response: { userId?: number }) => {
        if (!user && savePersonalInfo && info) {
          localStorage.setItem("deped_personal_info", JSON.stringify(info));
        }

        if (response.userId != null && !user) {
          setTimeout(() => {
            setLocation(`/verify-otp?userId=${response.userId}`);
          }, 1500);
        } else {
          setTimeout(() => {
            setLocation("/dashboard");
          }, 1500);
        }
      },
      onError: () => {
        setStep(pendingRequest ? "personal-info" : "request-details");
      },
    });
  };

  const handleRequestSubmit = (values: RequestFormValues) => {
    if (user) {
      submitPayload(values, null);
      return;
    }

    if (personalInfo) {
      submitPayload(values, personalInfo);
      return;
    }

    setPendingRequest(values);
    setStep("personal-info");
  };

  const handlePersonalInfoSubmit = async (values: any) => {
    const typedValues = values as PersonalInfo;
    if (!pendingRequest) {
      setStep("request-details");
      return;
    }

    try {
      const response = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: typedValues.email, phone: typedValues.phone }),
      });
      if (response.ok) {
        await response.json();
        // informational only; user may still proceed
      }
    } catch {
      // ignore
    }

    setPersonalInfo(typedValues);
    submitPayload(pendingRequest, typedValues);
  };

  const handleBackFromPersonal = () => {
    if (pendingRequest) {
      requestForm.reset(pendingRequest);
    }
    setStep("request-details");
    setPendingRequest(null);
  };

  if (isCheckingUser || isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const needsContactStep = !user && !personalInfo;

  return (
    <div className="min-h-screen bg-[hsl(var(--muted))]/50">
      <div className="max-w-2xl mx-auto py-6 px-4">
        {/* Header with logo and theme colors */}
        <div className="mb-8 rounded-xl bg-white border border-[hsl(var(--border))] shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="flex items-start gap-4">
              <img
                src="/DepEdMdq_logo.jfif"
                alt="DepEd Marinduque"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-lg border border-[hsl(var(--border))] bg-white shrink-0"
              />
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-bold text-[hsl(var(--foreground))] mb-1">
                  DepEd Marinduque
                </h1>
                <p className="text-lg font-medium text-primary">IT Service Request</p>
                <p className="text-sm text-muted-foreground mt-1">Submit a Request — No Account Required.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setLocation("/user-login")} className="gap-2 border-primary text-primary hover:bg-primary/10">
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/login")} className="gap-2 border-primary text-primary hover:bg-primary/10">
                <LogIn className="w-4 h-4" />
                Admin
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-8 flex items-stretch gap-2 sm:gap-4 text-sm">
          <div
            className={`flex-1 flex items-center gap-2 pb-3 border-b-2 ${
              step === "request-details" ? "border-primary" : "border-[hsl(var(--border))]"
            }`}
          >
            <div
              className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${
                step === "request-details"
                  ? "bg-primary text-primary-foreground"
                  : step === "personal-info" || step === "submit"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {step === "personal-info" || step === "submit" ? <CheckCircle className="w-5 h-5" /> : "1"}
            </div>
            <span className="font-medium leading-tight">Request Details</span>
          </div>
          <div
            className={`flex-1 flex items-center gap-2 pb-3 border-b-2 ${
              !needsContactStep ? "border-[hsl(var(--border))] opacity-60" : step === "personal-info" ? "border-primary" : "border-[hsl(var(--border))]"
            }`}
          >
            <div
              className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${
                !needsContactStep
                  ? "bg-muted text-muted-foreground"
                  : step === "personal-info"
                    ? "bg-primary text-primary-foreground"
                    : step === "submit"
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {!needsContactStep ? "—" : step === "submit" ? <CheckCircle className="w-5 h-5" /> : "2"}
            </div>
            <span className="font-medium leading-tight">
              Your Information
              {!needsContactStep && <span className="block text-xs font-normal text-muted-foreground">Saved on this device</span>}
            </span>
          </div>
        </div>

      {step === "personal-info" && (
        <Card className="border-primary/30 bg-white shadow-md">
          <CardHeader className="border-b border-[hsl(var(--border))] bg-muted/30 rounded-t-lg">
            <CardTitle className="text-primary">Your Information</CardTitle>
            <CardDescription>
              To submit your request, we need your name, contact number, email, and whether you're from the SDO or a school.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...personalForm}>
              <form onSubmit={personalForm.handleSubmit(handlePersonalInfoSubmit) as any} className="space-y-6">
                <FormField
                  control={personalForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Dela Cruz" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={personalForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="name@deped.gov.ph" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={personalForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="09123456789" {...field} />
                      </FormControl>
                      <FormDescription>Used for OTP and status updates via SMS.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={personalForm.control}
                  name="locationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request From</FormLabel>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="sdo"
                            value="sdo"
                            checked={field.value === "sdo"}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              personalForm.setValue("office", "HR");
                            }}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <label htmlFor="sdo" className="text-sm cursor-pointer font-medium">
                            SDO (Schools Division Office)
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="school"
                            value="school"
                            checked={field.value === "school"}
                            onChange={(e) => {
                              field.onChange(e.target.value);
                              personalForm.setValue("office", "");
                            }}
                            className="w-4 h-4 cursor-pointer"
                          />
                          <label htmlFor="school" className="text-sm cursor-pointer font-medium">
                            School
                          </label>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {personalForm.watch("locationType") === "sdo" ? (
                  <FormField
                    control={personalForm.control}
                    name="office"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Office / Unit</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select office or unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {OFFICE_OPTIONS.map((office) => (
                              <SelectItem key={office} value={office} className="bg-[hsl(205_90%_97%)] focus:bg-primary/15 focus:text-primary-foreground data-[highlight]:bg-primary/20">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                  {office}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={personalForm.control}
                    name="office"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., San Roque Elementary School" {...field} />
                        </FormControl>
                        <FormDescription>Enter the name of your school.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex items-start space-x-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <Checkbox
                    id="save-info"
                    checked={savePersonalInfo}
                    onCheckedChange={(checked) => setSavePersonalInfo(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="save-info" className="text-sm leading-snug cursor-pointer">
                    Remember my details on this device for my next request
                  </label>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={handleBackFromPersonal} className="flex-1">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Edit Request
                  </Button>
                  <Button type="submit" className="flex-1" size="lg" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Submitting…
                      </>
                    ) : (
                      "Submit & verify"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {step === "request-details" && (
        <Card className="border-primary/20 bg-white shadow-md">
          <CardHeader className="border-b border-[hsl(var(--border))] bg-muted/30 rounded-t-lg">
            <CardTitle className="text-primary">Service Request</CardTitle>
            <CardDescription>
              Describe what you need. {needsContactStep ? "You will enter your contact details on the next step." : "We will send an OTP to confirm your submission."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...requestForm}>
              <form onSubmit={requestForm.handleSubmit(handleRequestSubmit)} className="space-y-6">
                <FormField
                  control={requestForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Printer not working — Room 302" {...field} className="text-base font-medium" />
                      </FormControl>
                      <FormDescription>Short and specific.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Request From</label>
                    <div className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="req-sdo"
                          value="sdo"
                          checked={requestLocationType === "sdo"}
                          onChange={(e) => {
                            setRequestLocationType(e.target.value as "sdo" | "school");
                            requestForm.setValue("office", "HR");
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="req-sdo" className="text-sm cursor-pointer font-medium">
                          SDO (Schools Division Office)
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="req-school"
                          value="school"
                          checked={requestLocationType === "school"}
                          onChange={(e) => {
                            setRequestLocationType(e.target.value as "sdo" | "school");
                            requestForm.setValue("office", "");
                          }}
                          className="w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="req-school" className="text-sm cursor-pointer font-medium">
                          School
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                  {requestLocationType === "sdo" ? (
                    <FormField
                      control={requestForm.control}
                      name="office"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Office / Unit</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select office" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {OFFICE_OPTIONS.map((office) => (
                                <SelectItem key={office} value={office} className="bg-[hsl(205_90%_97%)] focus:bg-primary/15 focus:text-primary-foreground data-[highlight]:bg-primary/20">
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                    {office}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={requestForm.control}
                      name="office"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>School Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., San Roque Elementary School" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={requestForm.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {["Hardware", "Software", "Network", "Account", "Other"].map((cat) => (
                              <SelectItem key={cat} value={cat} className="bg-[hsl(205_50%_96%)] focus:bg-primary/15 focus:text-primary-foreground data-[highlight]:bg-primary/20">
                                <span className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-[hsl(205_70%_45%)] shrink-0" />
                                  {cat}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={requestForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[
                              { value: "low", label: "Low", bg: "bg-slate-100", dot: "bg-slate-500" },
                              { value: "medium", label: "Medium", bg: "bg-blue-100", dot: "bg-blue-600" },
                              { value: "high", label: "High", bg: "bg-amber-100", dot: "bg-amber-600" },
                              { value: "urgent", label: "Urgent", bg: "bg-red-100", dot: "bg-red-600" },
                            ].map((pri) => (
                              <SelectItem key={pri.value} value={pri.value} className={`${pri.bg} focus:bg-primary/15 focus:text-primary-foreground data-[highlight]:bg-primary/20`}>
                                <span className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${pri.dot} shrink-0`} />
                                  {pri.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={requestForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What happened? What do you need?" className="min-h-[140px] resize-y" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full sm:w-auto min-w-[200px] bg-primary hover:bg-primary/90 text-primary-foreground" size="lg" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Working…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      {needsContactStep ? "Continue" : "Submit request"}
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {step === "submit" && (
        <Card className="border-primary/30 bg-primary/5 shadow-md">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="mb-4 flex justify-center">
              <div className="rounded-full bg-secondary/30 p-3 border-2 border-secondary">
                <CheckCircle className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[hsl(var(--foreground))] mb-2">Almost done</h2>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              {user ? (
                <>Your request was submitted. Redirecting to your dashboard…</>
              ) : (
                <>Check your email and phone for a verification code. Redirecting to OTP…</>
              )}
            </p>
            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
