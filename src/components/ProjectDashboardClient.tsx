'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Circle, KanbanSquare } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface ProjectDashboardClientProps {
    projects: string[][];
    headers: string[];
}

const StatusIndicator = ({ status }: { status: string }) => {
    const statusMap: Record<string, { label: string; color: string; icon: JSX.Element }> = {
        'In Review': { label: 'In Review', color: 'bg-yellow-500', icon: <Circle className="h-2.5 w-2.5 text-yellow-500 fill-current" /> },
        'Ongoing': { label: 'Ongoing', color: 'bg-blue-500', icon: <Circle className="h-2.5 w-2.5 text-blue-500 fill-current" /> },
        'Completed': { label: 'Completed', color: 'bg-green-500', icon: <Circle className="h-2.5 w-2.5 text-green-500 fill-current" /> },
    };

    const currentStatus = statusMap[status] || { label: status, color: 'bg-gray-500', icon: <Circle className="h-2.5 w-2.5 text-gray-500 fill-current" /> };

    return (
        <Badge variant="outline" className="flex items-center gap-2 capitalize">
           {currentStatus.icon}
           <span>{currentStatus.label}</span>
        </Badge>
    );
};

const VISIBLE_COLUMNS = ['Project ID', 'Project Title', 'Status', 'Start Date', 'End Date'];

export function ProjectDashboardClient({ projects, headers }: ProjectDashboardClientProps) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const projectIdIndex = headers.indexOf('Project ID');
  const projectTitleIndex = headers.indexOf('Project Title');
  const statusIndex = headers.indexOf('Status');
  const kanbanInitializedIndex = headers.indexOf('Kanban Initialized');

  const visibleHeaders = useMemo(() => {
    return headers.filter(h => VISIBLE_COLUMNS.includes(h));
  }, [headers]);

  const filteredProjects = useMemo(() => projects.filter(row => {
    const matchesSearch = (() => {
        if (!searchQuery) return true;
        const projectId = projectIdIndex !== -1 ? row[projectIdIndex] || '' : '';
        const projectTitle = projectTitleIndex !== -1 ? row[projectTitleIndex] || '' : '';
        const queryLower = searchQuery.toLowerCase();
        return projectId.toLowerCase().includes(queryLower) || projectTitle.toLowerCase().includes(queryLower);
    })();
    
    const matchesStatus = statusFilter === 'all' || (statusIndex !== -1 && row[statusIndex] === statusFilter);

    return matchesSearch && matchesStatus;
  }), [projects, searchQuery, statusFilter, projectIdIndex, projectTitleIndex, statusIndex]);


  const statuses = ["all", "In Review", "Ongoing", "Completed"];

  return (
    <>
      <h1 className="text-3xl font-bold mb-6">Project Dashboard</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>View the status and details of all projects.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="relative">
                <Label htmlFor="search-id">Search by ID or Title</Label>
                <Search className="absolute left-3 top-9 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-id"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
               <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status-filter">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          {statuses.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
            </div>
          </div>
            <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                        {visibleHeaders.map((header) => (
                          <TableHead key={header}>{header}</TableHead>
                        ))}
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.length > 0 ? (
                      filteredProjects.map((row, rowIndex) => {
                        const hasKanban = row[kanbanInitializedIndex] === 'Yes';
                        const projectId = row[projectIdIndex];
                        return (
                        <TableRow key={rowIndex}>
                          {visibleHeaders.map((header) => {
                             const cellIndex = headers.indexOf(header);
                             const cell = row[cellIndex];
                             if (header === 'Status') {
                                return <TableCell key={header}><StatusIndicator status={cell} /></TableCell>
                             }
                             return <TableCell key={header}>{cell}</TableCell>
                          })}
                          <TableCell className="text-right">
                              {hasKanban && (
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/kanban/${projectId}`}>
                                        <KanbanSquare className="mr-2 h-4 w-4" />
                                        View Board
                                    </Link>
                                </Button>
                              )}
                          </TableCell>
                        </TableRow>
                      );
                      })
                    ) : (
                      <TableRow>
                          <TableCell colSpan={visibleHeaders.length + 1} className="h-24 text-center">
                              No projects found.
                          </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>
    </>
  );
}
