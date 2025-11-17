'use client';

import { useState, useEffect } from 'react';
import { getProjects } from '../actions';
import { ProjectDashboardClient } from '@/components/ProjectDashboardClient';
import { Loader2 } from 'lucide-react';
import { unstable_noStore as noStore } from 'next/cache';

function ProjectsDashboardPage() {
    noStore();
    const [projects, setProjects] = useState<string[][]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            try {
                const projectData = await getProjects();
                if (projectData && projectData.values && projectData.values.length > 0) {
                    setHeaders(projectData.values[0]);
                    setProjects(projectData.values.slice(1).reverse());
                }
            } catch (error) {
                console.error("Failed to fetch projects for dashboard:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-80px)]">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading Projects...</span>
            </div>
        )
    }

    return (
       <div className="bg-background flex-1">
            <main className="container mx-auto py-8 px-4 md:px-6">
                <ProjectDashboardClient 
                    projects={projects}
                    headers={headers}
                />
            </main>
        </div>
    );
}

export default ProjectsDashboardPage;
