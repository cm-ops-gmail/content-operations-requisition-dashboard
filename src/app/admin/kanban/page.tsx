
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getProjects } from '@/app/actions';
import { Loader2, KanbanSquare } from 'lucide-react';

export default function KanbanListPage() {
  const [projects, setProjects] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const projectData = await getProjects();
      if (projectData && projectData.values && projectData.values.length > 0) {
        setHeaders(projectData.values[0]);
        // Filter for projects where Kanban is initialized and reverse sort
        const kanbanInitializedIndex = projectData.values[0].indexOf('Kanban Initialized');
        const allProjects = projectData.values.slice(1);
        const kanbanProjects = allProjects.filter(p => p[kanbanInitializedIndex] === 'Yes');
        setProjects(kanbanProjects.reverse());
      } else {
        setHeaders([]);
        setProjects([]);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load project data from Google Sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const projectIdIndex = headers.indexOf('Project ID');
  const projectTitleIndex = headers.indexOf('Project Title');

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Kanban Boards</h1>
      </div>
      <Card>
          <CardHeader>
            <CardTitle>Active Project Boards</CardTitle>
            <CardDescription>
                Select a project to view its Kanban board and manage tasks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center py-8"><Loader2 className="mr-2 h-8 w-8 animate-spin" /> Loading boards...</div>
            ) : error ? (
                <p className="text-destructive text-center py-8">{error}</p>
            ) : projects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    <p>No active Kanban boards found.</p>
                    <p className="mt-2">You can create one from the <Link href="/admin/projects" className="text-primary underline">Projects</Link> tab.</p>
                </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((row, rowIndex) => {
                  const projectId = row[projectIdIndex] || '';
                  const projectTitle = row[projectTitleIndex] || 'Untitled Project';
                  return (
                  <TableRow key={rowIndex}>
                    <TableCell className="font-medium">
                      <div>{projectTitle}</div>
                      <div className="text-xs text-muted-foreground">{projectId}</div>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button asChild>
                         <Link href={`/admin/kanban/${row[projectIdIndex]}`}>
                           <KanbanSquare className="mr-2 h-4 w-4" />
                           View Board
                         </Link>
                       </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
