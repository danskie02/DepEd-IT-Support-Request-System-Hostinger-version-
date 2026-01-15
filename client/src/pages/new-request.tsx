import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRequestSchema } from "@shared/schema";
import { useCreateRequest } from "@/hooks/use-requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Loader2, ArrowLeft, Send } from "lucide-react";
import { useLocation, Link } from "wouter";

export default function NewRequestPage() {
  const { mutate: createRequest, isPending } = useCreateRequest();
  const [, setLocation] = useLocation();

  const form = useForm({
    resolver: zodResolver(insertRequestSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "Hardware",
      priority: "medium"
    },
  });

  function onSubmit(values: any) {
    createRequest(values, {
      onSuccess: () => {
        setLocation("/dashboard");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-4 w-fit">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-3xl font-display font-bold text-gray-900">Submit New Request</h1>
        <p className="text-muted-foreground">Provide details about the IT service you require.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Request Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Printer Malfunction in Room 302" {...field} className="text-lg font-medium" />
                </FormControl>
                <FormDescription>Keep it short and descriptive.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Hardware">Hardware Issue</SelectItem>
                      <SelectItem value="Software">Software Installation</SelectItem>
                      <SelectItem value="Network">Internet/Network</SelectItem>
                      <SelectItem value="Account">Account Access</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority Level</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low - Can wait a week</SelectItem>
                      <SelectItem value="medium">Medium - Needed in few days</SelectItem>
                      <SelectItem value="high">High - Needed ASAP</SelectItem>
                      <SelectItem value="urgent">Urgent - Work stoppage</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Detailed Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe the issue in detail..." 
                    className="min-h-[150px] resize-y"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="pt-4 flex gap-4">
            <Button 
              type="submit" 
              size="lg" 
              className="flex-1 font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Send className="mr-2 h-5 w-5" /> Submit Request</>}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => setLocation("/dashboard")}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
