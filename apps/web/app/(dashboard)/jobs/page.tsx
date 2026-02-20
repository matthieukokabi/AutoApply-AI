import { Metadata } from "next";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, MapPin, DollarSign, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
    title: "Job Feed — AutoApply AI",
    description: "Browse discovered jobs with AI compatibility scores",
};

export default function JobsPage() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Job Feed</h1>
                    <p className="text-muted-foreground">
                        Browse discovered jobs sorted by compatibility score.
                    </p>
                </div>
                <Button className="gap-2">
                    <Search className="h-4 w-4" />
                    Paste Job URL
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <input
                    className="px-3 py-2 border rounded-md text-sm w-64"
                    placeholder="Search by title or company..."
                />
                <select className="px-3 py-2 border rounded-md text-sm">
                    <option value="">All Sources</option>
                    <option value="adzuna">Adzuna</option>
                    <option value="themuse">The Muse</option>
                    <option value="remotive">Remotive</option>
                    <option value="arbeitnow">Arbeitnow</option>
                    <option value="manual">Manual</option>
                </select>
                <select className="px-3 py-2 border rounded-md text-sm">
                    <option value="">Min Score: Any</option>
                    <option value="60">60+</option>
                    <option value="75">75+</option>
                    <option value="90">90+</option>
                </select>
            </div>

            {/* Jobs List */}
            <div className="space-y-4">
                {/* Empty state */}
                <Card>
                    <CardContent className="py-12 text-center">
                        <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No jobs discovered yet</h3>
                        <p className="text-muted-foreground mb-4">
                            Set up your preferences in Settings, or paste a job URL to get started.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline">Configure Preferences</Button>
                            <Button>Paste Job URL</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Example job card (will be dynamic) */}
                {/*
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">Senior Frontend Engineer</h3>
                  <Badge variant="secondary">85% Match</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Acme Corp</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Remote
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> $120k - $160k
                  </span>
                </div>
                <div className="flex gap-1 mt-2">
                  <Badge variant="outline" className="text-xs">React</Badge>
                  <Badge variant="outline" className="text-xs">TypeScript</Badge>
                  <Badge variant="outline" className="text-xs">Next.js</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" /> View
                </Button>
                <Button size="sm">Tailor CV</Button>
              </div>
            </div>
          </CardContent>
        </Card>
        */}
            </div>
        </div>
    );
}
