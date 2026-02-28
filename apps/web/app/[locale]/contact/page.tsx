"use client";

import { useState } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Mail, Check } from "lucide-react";

export default function ContactPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [messageBody, setMessageBody] = useState("");
    const [submitted, setSubmitted] = useState(false);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        // In production, this would POST to an API endpoint or email service
        setSubmitted(true);
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b">
                <div className="container flex h-14 items-center">
                    <Link href="/" className="flex items-center space-x-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                        <span className="font-bold text-xl">AutoApply AI</span>
                    </Link>
                </div>
            </header>

            <main className="container max-w-2xl py-12">
                <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
                <p className="text-muted-foreground mb-8">
                    Have questions, feedback, or need support? We&apos;d love to hear from you.
                </p>

                {submitted ? (
                    <Card>
                        <CardContent className="flex flex-col items-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <Check className="h-6 w-6 text-green-600" />
                            </div>
                            <h2 className="text-xl font-semibold mb-2">Message Sent</h2>
                            <p className="text-muted-foreground">
                                Thank you for reaching out. We&apos;ll get back to you within 24-48 hours.
                            </p>
                            <Link href="/" className="mt-6">
                                <Button variant="outline">Back to Home</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Send us a message
                            </CardTitle>
                            <CardDescription>
                                Fill out the form below and we&apos;ll respond as soon as possible.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="text-sm font-medium block mb-1">Name</label>
                                        <input
                                            required
                                            className="w-full px-3 py-2 border rounded-md text-sm"
                                            placeholder="Your name"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium block mb-1">Email</label>
                                        <input
                                            required
                                            type="email"
                                            className="w-full px-3 py-2 border rounded-md text-sm"
                                            placeholder="you@example.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">Subject</label>
                                    <select
                                        className="w-full px-3 py-2 border rounded-md text-sm"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    >
                                        <option value="">Select a topic</option>
                                        <option value="general">General Inquiry</option>
                                        <option value="support">Technical Support</option>
                                        <option value="billing">Billing Question</option>
                                        <option value="privacy">Privacy / Data Request</option>
                                        <option value="feedback">Feedback</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium block mb-1">Message</label>
                                    <textarea
                                        required
                                        className="w-full h-32 px-3 py-2 border rounded-md text-sm resize-none"
                                        placeholder="How can we help?"
                                        value={messageBody}
                                        onChange={(e) => setMessageBody(e.target.value)}
                                    />
                                </div>
                                <Button type="submit" className="w-full">
                                    Send Message
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}
