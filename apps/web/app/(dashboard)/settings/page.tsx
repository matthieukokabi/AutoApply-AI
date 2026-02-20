import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
    title: "Settings — AutoApply AI",
    description: "Configure your job preferences and automation settings",
};

export default function SettingsPage() {
    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Configure your job preferences and automation settings.
                </p>
            </div>

            {/* Job Preferences */}
            <Card>
                <CardHeader>
                    <CardTitle>Job Preferences</CardTitle>
                    <CardDescription>
                        Define what jobs you&apos;re looking for. The AI will use these to
                        filter and score job listings.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium block mb-1">
                            Target Job Titles
                        </label>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="e.g. Frontend Engineer, Full Stack Developer, React Developer"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Comma-separated list of desired job titles
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">Locations</label>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="e.g. London, Berlin, New York"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            Remote Preference
                        </label>
                        <select className="w-full px-3 py-2 border rounded-md text-sm">
                            <option value="any">Any</option>
                            <option value="remote">Remote Only</option>
                            <option value="hybrid">Hybrid</option>
                            <option value="onsite">On-site</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">
                            Minimum Salary (Annual, USD)
                        </label>
                        <input
                            type="number"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="e.g. 80000"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium block mb-1">Industries</label>
                        <input
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            placeholder="e.g. Technology, Finance, Healthcare"
                        />
                    </div>

                    <Button>Save Preferences</Button>
                </CardContent>
            </Card>

            {/* Automation */}
            <Card>
                <CardHeader>
                    <CardTitle>Automation</CardTitle>
                    <CardDescription>
                        Enable automated job discovery. When on, the system checks for new
                        matching jobs every 4 hours.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Automated Job Discovery</p>
                            <p className="text-sm text-muted-foreground">
                                Requires Pro or Unlimited subscription
                            </p>
                        </div>
                        <Button variant="outline" disabled>
                            Disabled
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Subscription */}
            <Card>
                <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>
                        Manage your plan and billing.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Current Plan</p>
                            <Badge variant="secondary">Free</Badge>
                        </div>
                        <Button>Upgrade</Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Credits Remaining</p>
                            <p className="text-sm text-muted-foreground">3 of 3 this month</p>
                        </div>
                        <Button variant="outline">Buy Credits</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Data Management (GDPR) */}
            <Card>
                <CardHeader>
                    <CardTitle>Data Management</CardTitle>
                    <CardDescription>
                        GDPR-compliant data controls. You have full control over your data.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Export My Data</p>
                            <p className="text-sm text-muted-foreground">
                                Download all your data in JSON format
                            </p>
                        </div>
                        <Button variant="outline">Export</Button>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-destructive">Delete Account</p>
                            <p className="text-sm text-muted-foreground">
                                Permanently delete your account and all associated data
                            </p>
                        </div>
                        <Button variant="destructive">Delete Account</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
