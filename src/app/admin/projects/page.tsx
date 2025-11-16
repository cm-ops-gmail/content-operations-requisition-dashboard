

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getProjects, getMembers, updateProject, initializeKanban } from '@/app/actions';
import { Loader2, Calendar as CalendarIcon, User, KanbanSquare, Check, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [members, setMembers] = useState<string[][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProject, setSelectedProject] = useState<{rowIndex: number, values: string[]} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectIdFilter, setProjectIdFilter] = useState('');
  const [ticketIdFilter, setTicketIdFilter] = useState('');
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [projectData, memberData] = await Promise.all([getProjects(), getMembers()]);

      if (projectData && projectData.values && projectData.values.length > 0) {
        setHeaders(projectData.values[0]);
        setProjects(projectData.values.slice(1).reverse());
      } else {
        setHeaders([]);
        setProjects([]);
      }

      if (memberData && memberData.values && memberData.values.length > 0) {
        setMembers(memberData.values.slice(1));
      }

    } catch (err) {
      console.error(err);
      setError("Failed to load data from Google Sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  const handleUpdate = async (rowIndex: number, field: string, value: string) => {
    const originalIndex = projects.length - 1 - rowIndex;
    const result = await updateProject(originalIndex + 1, { [field]: value });
     if (result.success) {
      toast({
        title: 'Success!',
        description: `Project has been updated.`,
      });
      await fetchData(); 
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'An unknown error occurred.',
      });
    }
  }
  
  const handleSelectProject = (rowIndex: number, values: string[]) => {
     if (selectedProject?.rowIndex === rowIndex) {
        setSelectedProject(null);
     } else {
        setSelectedProject({ rowIndex, values });
     }
  }


  const handleCreateKanban = async () => {
    if (!selectedProject) return;

    setIsSubmitting(true);
    const projectId = selectedProject.values[projectIdIndex];
    const originalIndex = projects.length - 1 - selectedProject.rowIndex;
    const result = await initializeKanban(originalIndex, projectId);

    if (result.success) {
        toast({
            title: 'Kanban Board Initialized!',
            description: 'A new Kanban board has been created for this project.'
        });
        setSelectedProject(null);
        await fetchData();
    } else {
         toast({
            variant: 'destructive',
            title: 'Error',
            description: result.error || 'Failed to create Kanban board.'
        });
    }
    setIsSubmitting(false);
  }

  const canManage = user?.role === 'admin' || user?.role === 'sub-admin';
  const projectIdIndex = headers.indexOf('Project ID');
  const projectTitleIndex = headers.indexOf('Project Title');
  const ticketIdIndex = headers.indexOf('Ticket ID');
  const startDateIndex = headers.indexOf('Start Date');
  const endDateIndex = headers.indexOf('End Date');
  const assigneeIndex = headers.indexOf('Assignee');
  const kanbanInitializedIndex = headers.indexOf('Kanban Initialized');
  const canCreateKanban = selectedProject && selectedProject.values[kanbanInitializedIndex] !== 'Yes' && canManage;
  
  const filteredProjects = projects.filter(project => {
    const projectId = project[projectIdIndex] || '';
    const ticketId = project[ticketIdIndex] || '';
    return (
        projectId.toLowerCase().includes(projectIdFilter.toLowerCase()) &&
        ticketId.toLowerCase().includes(ticketIdFilter.toLowerCase())
    );
  });

  const DatePickerCell = ({ rowIndex, cell, field }: { rowIndex: number; cell: string; field: 'Start Date' | 'End Date' }) => (
    <TableCell>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className="w-[200px] justify-start text-left font-normal"
            disabled={!canManage}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {cell ? format(new Date(cell), "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={cell ? new Date(cell) : undefined}
            onSelect={(date) => handleUpdate(rowIndex, field, date ? date.toISOString() : '')}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </TableCell>
  );
  
  const truncateHeader = (header: string, wordLimit: number) => {
    const words = header.split(' ');
    if (words.length > wordLimit) {
      return words.slice(0, wordLimit).join(' ') + '...';
    }
    return header;
  };

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Manage Projects</h1>
        {canCreateKanban && (
            <Button onClick={handleCreateKanban} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KanbanSquare className="mr-2 h-4 w-4" />}
                Create Kanban Board
            </Button>
        )}
      </div>

       <Card className="mb-6">
        <CardContent className="p-4 flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Project ID..."
                value={projectIdFilter}
                onChange={(e) => setProjectIdFilter(e.target.value)}
                className="pl-10"
              />
            </div>
             <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Ticket ID..."
                value={ticketIdFilter}
                onChange={(e) => setTicketIdFilter(e.target.value)}
                className="pl-10"
              />
            </div>
        </CardContent>
       </Card>

      <Card>
          <CardHeader>
            <CardTitle>Projects from Google Sheet</CardTitle>
            <CardDescription>
                These projects were created from tickets and are stored in the 'Projects' sheet. Select one to create a Kanban board.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center py-8"><Loader2 className="mr-2 h-8 w-8 animate-spin" /> Loading projects...</div>
            ) : error ? (
                <p className="text-destructive text-center py-8">{error}</p>
            ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Select</TableHead>
                    <TooltipProvider>
                    {headers.map((header) => (
                      <TableHead key={header}>
                         <Tooltip>
                            <TooltipTrigger>
                                <span className="block truncate">{truncateHeader(header, 15)}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{header}</p>
                            </TooltipContent>
                        </Tooltip>
                      </TableHead>
                    ))}
                    </TooltipProvider>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell>
                        <Checkbox 
                            checked={selectedProject?.rowIndex === projects.indexOf(row)}
                            onCheckedChange={() => handleSelectProject(projects.indexOf(row), row)}
                            disabled={!canManage}
                        />
                    </TableCell>
                    {row.map((cell, cellIndex) => {
                       if (cellIndex === startDateIndex) {
                         return <DatePickerCell key={cellIndex} rowIndex={projects.indexOf(row)} cell={cell} field="Start Date" />;
                       }
                       if (cellIndex === endDateIndex) {
                        return <DatePickerCell key={cellIndex} rowIndex={projects.indexOf(row)} cell={cell} field="End Date" />;
                       }
                       if (cellIndex === assigneeIndex) {
                          return (
                           <TableCell key={cellIndex}>
                               <Select onValueChange={(value) => handleUpdate(projects.indexOf(row), 'Assignee', value)} defaultValue={cell} disabled={!canManage}>
                                <SelectTrigger className="w-[180px]">
                                    <User className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="Assign a member" />
                                </SelectTrigger>
                                <SelectContent>
                                    {members.map((member, i) => (
                                        <SelectItem key={i} value={member[0]}>{member[0]} ({member[1]})</SelectItem>
                                    ))}
                                </SelectContent>
                               </Select>
                           </TableCell>
                          )
                       }
                       if (cellIndex === kanbanInitializedIndex) {
                            const projectId = row[projectIdIndex];
                            return (
                                <TableCell key={cellIndex}>
                                    {cell === 'Yes' ? (
                                        <Button asChild variant="secondary">
                                            <Link href={`/admin/kanban/${projectId}`}>
                                               <Check className="mr-2" /> View Kanban
                                            </Link>
                                        </Button>
                                    ) : (
                                        <span className="text-muted-foreground">No</span>
                                    )}
                                </TableCell>
                            )
                       }
                       // Display project title more prominently
                       if (cellIndex === projectTitleIndex && cell) {
                           return <TableCell key={cellIndex} className="font-semibold">{cell}</TableCell>
                       }
                       return <TableCell key={cellIndex}>{cell}</TableCell>
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
