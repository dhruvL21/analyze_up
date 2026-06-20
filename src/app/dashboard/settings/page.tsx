"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useData } from "@/context/data-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { toast } = useToast();
  const { clearAllData, activePlan, isProcessingPayment, handleUpgrade } = useData();

  const handleUpdateProfile = () => {
    toast({
      title: "Profile Updated",
      description: "Your profile information has been saved.",
    });
  };

  const handleSaveChanges = () => {
    toast({
      title: "Workspace Settings Saved",
      description: "Your workspace settings have been updated.",
    });
  };

  const handleResetWorkspace = async () => {
    try {
      await clearAllData();
    } catch (error) {
      console.error("Reset failed:", error);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold md:text-2xl">Settings</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Update your personal information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="Workspace Owner" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="owner@example.com" />
            </div>
            <Button onClick={handleUpdateProfile}>Update Profile</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>
              Manage your workspace settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input id="workspace-name" defaultValue="AnalyzeUp" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select defaultValue="gmt-5">
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmt-8">
                    (GMT-08:00) Pacific Time
                  </SelectItem>
                  <SelectItem value="gmt-5">
                    (GMT-05:00) Eastern Time
                  </SelectItem>
                  <SelectItem value="gmt">
                    (GMT+00:00) Greenwich Mean Time
                  </SelectItem>
                  <SelectItem value="gmt+1">
                    (GMT+01:00) Central European Time
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveChanges}>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Billing & Subscriptions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Billing & Subscriptions</CardTitle>
            <CardDescription>
              Manage your workspace subscription plan. Current tier:{" "}
              <span className="font-bold text-primary">{activePlan}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Plan 1: Free Trial */}
              <div
                className={`flex flex-col justify-between p-5 rounded-2xl border ${
                  activePlan === "Free Trial"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card"
                } transition-all duration-200`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base">Free Trial</span>
                    {activePlan === "Free Trial" && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-extrabold mb-4">
                    ₹0{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / month
                    </span>
                  </div>
                  <ul className="space-y-2.5 mb-6 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Up to 50 products
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Basic inventory tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Manual reporting
                    </li>
                  </ul>
                </div>
                <Button variant="outline" disabled={activePlan === "Free Trial"}>
                  {activePlan === "Free Trial" ? "Current Plan" : "Downgrade"}
                </Button>
              </div>

              {/* Plan 2: Starter Plan */}
              <div
                className={`flex flex-col justify-between p-5 rounded-2xl border ${
                  activePlan === "Starter Plan"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card"
                } transition-all duration-200`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base">Starter Plan</span>
                    {activePlan === "Starter Plan" && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-extrabold mb-4">
                    ₹499{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / month
                    </span>
                  </div>
                  <ul className="space-y-2.5 mb-6 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Up to 500 products
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /> AI reorder alerts
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Dynamic CSV exports
                    </li>
                  </ul>
                </div>
                <Button
                  onClick={() => handleUpgrade("starter_monthly", 499, "Starter Plan")}
                  disabled={activePlan === "Starter Plan" || isProcessingPayment !== null}
                  className={
                    activePlan === "Starter Plan"
                      ? ""
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }
                >
                  {isProcessingPayment === "starter_monthly" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : activePlan === "Starter Plan" ? (
                    "Current Plan"
                  ) : (
                    "Upgrade to Starter"
                  )}
                </Button>
              </div>

              {/* Plan 3: Pro Plan */}
              <div
                className={`flex flex-col justify-between p-5 rounded-2xl border ${
                  activePlan === "Pro Plan"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card"
                } transition-all duration-200`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-base">Pro Plan</span>
                    {activePlan === "Pro Plan" && (
                      <Badge variant="secondary" className="bg-primary/20 text-primary">
                        Active
                      </Badge>
                    )}
                  </div>
                  <div className="text-3xl font-extrabold mb-4">
                    ₹999{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / month
                    </span>
                  </div>
                  <ul className="space-y-2.5 mb-6 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Unlimited products
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Advanced AI Advisor
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" /> Dynamic PDFs & analytics
                    </li>
                  </ul>
                </div>
                <Button
                  onClick={() => handleUpgrade("pro_monthly", 999, "Pro Plan")}
                  disabled={activePlan === "Pro Plan" || isProcessingPayment !== null}
                  className={
                    activePlan === "Pro Plan"
                      ? ""
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }
                >
                  {isProcessingPayment === "pro_monthly" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : activePlan === "Pro Plan" ? (
                    "Current Plan"
                  ) : (
                    "Upgrade to Pro"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              These actions are permanent and cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-destructive">Reset Workspace Data</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently delete all products, orders, suppliers, and transactions. Profile
                settings will remain.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Reset All Data</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all your inventory
                    records, sales history, and supplier information.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetWorkspace}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Reset Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
