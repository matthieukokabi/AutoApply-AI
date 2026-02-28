"use client";

import { useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { formatDate } from "@/lib/utils";

interface ApplicationWithJob {
    id: string;
    compatibilityScore: number;
    status: string;
    atsKeywords: string[];
    recommendation: string | null;
    createdAt: string;
    job: {
        id: string;
        title: string;
        company: string;
        location: string;
    };
}

const KANBAN_COLUMNS = [
    { id: "discovered", label: "Discovered", color: "bg-blue-500" },
    { id: "tailored", label: "Tailored", color: "bg-purple-500" },
    { id: "applied", label: "Applied", color: "bg-yellow-500" },
    { id: "interview", label: "Interview", color: "bg-emerald-500" },
    { id: "offer", label: "Offer", color: "bg-green-500" },
    { id: "rejected", label: "Rejected", color: "bg-red-500" },
];

export function KanbanBoard({
    initialApplications,
}: {
    initialApplications: ApplicationWithJob[];
}) {
    const [applications, setApplications] = useState(initialApplications);
    const [updating, setUpdating] = useState<string | null>(null);

    const groupedByStatus = KANBAN_COLUMNS.reduce(
        (acc, col) => {
            acc[col.id] = applications.filter((app) => app.status === col.id);
            return acc;
        },
        {} as Record<string, ApplicationWithJob[]>
    );

    async function handleDragEnd(result: DropResult) {
        const { draggableId, destination } = result;
        if (!destination) return;

        const newStatus = destination.droppableId;
        const app = applications.find((a) => a.id === draggableId);
        if (!app || app.status === newStatus) return;

        // Optimistic update
        setApplications((prev) =>
            prev.map((a) => (a.id === draggableId ? { ...a, status: newStatus } : a))
        );
        setUpdating(draggableId);

        try {
            const res = await fetch(`/api/applications/${draggableId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) {
                // Revert on failure
                setApplications((prev) =>
                    prev.map((a) => (a.id === draggableId ? { ...a, status: app.status } : a))
                );
            }
        } catch {
            // Revert on error
            setApplications((prev) =>
                prev.map((a) => (a.id === draggableId ? { ...a, status: app.status } : a))
            );
        } finally {
            setUpdating(null);
        }
    }

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-6 gap-4 min-h-[400px]">
                {KANBAN_COLUMNS.map((column) => (
                    <Droppable key={column.id} droppableId={column.id}>
                        {(provided, snapshot) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={`rounded-lg p-3 space-y-3 transition-colors ${
                                    snapshot.isDraggingOver
                                        ? "bg-muted"
                                        : "bg-muted/50"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${column.color}`} />
                                    <h3 className="text-sm font-medium">{column.label}</h3>
                                    <Badge variant="secondary" className="ml-auto text-xs">
                                        {groupedByStatus[column.id]?.length || 0}
                                    </Badge>
                                </div>
                                <div className="space-y-2 min-h-[300px]">
                                    {groupedByStatus[column.id]?.length === 0 && (
                                        <p className="text-xs text-muted-foreground text-center py-8">
                                            No applications
                                        </p>
                                    )}
                                    {groupedByStatus[column.id]?.map((app, index) => (
                                        <Draggable
                                            key={app.id}
                                            draggableId={app.id}
                                            index={index}
                                        >
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                >
                                                    <Card
                                                        className={`cursor-grab active:cursor-grabbing transition-shadow ${
                                                            snapshot.isDragging
                                                                ? "shadow-lg"
                                                                : ""
                                                        }`}
                                                    >
                                                        <CardContent className="p-3 space-y-2">
                                                            <div className="flex items-start justify-between">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm font-medium truncate">
                                                                        {app.job.title}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground truncate">
                                                                        {app.job.company}
                                                                    </p>
                                                                </div>
                                                                {updating === app.id && (
                                                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-xs"
                                                                >
                                                                    {app.compatibilityScore}%
                                                                </Badge>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatDate(app.createdAt)}
                                                                </span>
                                                            </div>
                                                            <Link href={`/documents/${app.id}`}>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full h-7 text-xs"
                                                                >
                                                                    <Eye className="h-3 w-3 mr-1" />
                                                                    View
                                                                </Button>
                                                            </Link>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            </div>
                        )}
                    </Droppable>
                ))}
            </div>
        </DragDropContext>
    );
}
