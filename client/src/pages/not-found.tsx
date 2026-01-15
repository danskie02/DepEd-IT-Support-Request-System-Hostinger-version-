import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4 shadow-xl border-t-4 border-t-red-500">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 text-red-500 items-center justify-center">
            <AlertCircle className="h-12 w-12" />
          </div>
          
          <h1 className="text-3xl font-display font-bold text-center text-gray-900 mb-2">
            404 Page Not Found
          </h1>
          
          <p className="text-center text-muted-foreground mb-8">
            The page you are looking for does not exist or has been moved.
          </p>

          <div className="flex justify-center">
            <Link href="/">
              <Button size="lg" className="font-bold">Return Home</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
