
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { getMyAssignedTasks, updateMyTaskStatus } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar as CalendarIcon, X, Ticket, Folder, KanbanSquare, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Input } from '@/components/ui/input';

type AssignedTask = {
  id: string;
  title: string;
  status: string;
  source: 'Ticket' | 'Project' | 'Kanban Task';
  sheetRowIndex: number;
  date: string; 
};

const SourceBadge = ({ source }: { source: AssignedTask['source'] }) => {
    const typeMap: Record<AssignedTask['source'], { label: string; color: string; icon: JSX.Element }> = {
        'Ticket': { label: 'Ticket', color: 'text-blue-500 border-blue-500/30 bg-blue-500/10', icon: <Ticket className="h-3 w-3" /> },
        'Project': { label: 'Project', color: 'text-purple-500 border-purple-500/30 bg-purple-500/10', icon: <Folder className="h-3 w-3" /> },
        'Kanban Task': { label: 'Kanban Task', color: 'text-green-500 border-green-500/30 bg-green-500/10', icon: <KanbanSquare className="h-3 w-3" /> },
    };
    const current = typeMap[source] || { label: source, color: 'text-gray-500', icon: null };

    return (
        <Badge variant="outline" className={cn('gap-1.5', current.color)}>
            {current.icon}
            <span>{current.label}</span>
        </Badge>
    );
};

const ticketStatuses = ["In Review", "In Progress", "Prioritized", "On Hold", "Delivered", "Completed"];
const projectStatuses = ["In Review", "Ongoing", "Completed"];
const kanbanStatuses = ["todo", "inprogress", "review", "done"];
const allPossibleStatuses = [...new Set([...ticketStatuses, ...projectStatuses, ...kanbanStatuses])];

const getStatusesForSource = (source: AssignedTask['source']): string[] => {
    switch (source) {
        case 'Ticket':
            return ticketStatuses;
        case 'Project':
            return projectStatuses;
        case 'Kanban Task':
            return kanbanStatuses;
        default:
            return [];
    }
}

export default function MyTasksPage() {
  const { user, isMounted } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  

  const fetchTasks = async (userName: string) => {
    setIsLoading(true);
    setError('');
    try {
      const assignedTasks = await getMyAssignedTasks(userName);
      setTasks(assignedTasks);
    } catch (err) {
      console.error(err);
      setError('Failed to load your tasks. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isMounted) {
      if (user) {
        fetchTasks(user.name);
      } else {
        router.push('/login');
      }
    }
  }, [isMounted, user, router]);

  const statusesForFilter = useMemo(() => {
    switch (sourceFilter) {
      case 'Ticket':
        return ticketStatuses;
      case 'Project':
        return projectStatuses;
      case 'Kanban Task':
        return kanbanStatuses;
      default:
        return allPossibleStatuses;
    }
  }, [sourceFilter]);

  // Reset status filter if it's no longer valid for the selected source
  useEffect(() => {
      if (!statusesForFilter.includes(statusFilter) && statusFilter !== 'all') {
          setStatusFilter('all');
      }
  }, [statusFilter, statusesForFilter]);


  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
        const matchesSearch = searchQuery === '' || task.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSource = sourceFilter === 'all' || task.source === sourceFilter;
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        
        const matchesDate = (() => {
            if (!fromDate && !toDate) return true;
            if (!task.date) return false;
            try {
                const taskDate = parseISO(task.date);
                const start = fromDate ? startOfDay(fromDate) : new Date(0);
                const end = toDate ? endOfDay(toDate) : new Date();
                return isWithinInterval(taskDate, { start, end });
            } catch {
                return false;
            }
        })();

        return matchesSearch && matchesSource && matchesStatus && matchesDate;
    });
  }, [tasks, searchQuery, sourceFilter, statusFilter, fromDate, toDate]);

  const handleStatusChange = async (task: AssignedTask, newStatus: string) => {
    const result = await updateMyTaskStatus({
      source: task.source,
      sheetRowIndex: task.sheetRowIndex,
      newStatus,
    });

    if (result.success) {
      toast({
        title: 'Task Updated',
        description: `Task status has been changed to "${newStatus}".`,
      });
      setTasks(prevTasks =>
        prevTasks.map(t => (t.id === task.id && t.source === task.source ? { ...t, status: newStatus } : t))
      );
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'Failed to update task status.',
      });
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSourceFilter('all');
    setStatusFilter('all');
    setFromDate(undefined);
    setToDate(undefined);
  };
  
  if (!isMounted || (isLoading && tasks.length === 0)) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-80px)]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading your tasks...</span>
      </div>
    );
  }
  
  if (!user) {
      return null;
  }

  const allSources = ['Ticket', 'Project', 'Kanban Task'];

  const DatePicker = ({ date, setDate, placeholder }: { date?: Date; setDate: (date?: Date) => void; placeholder: string; }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                )}
            >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>{placeholder}</span>}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
            <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
            />
        </PopoverContent>
    </Popover>
  );

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">My Assigned Tasks</h1>
      </div>

       <Card className="mb-6">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="lg:col-span-1">
                  <Label htmlFor="search-query">Search by ID/Title</Label>
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                          id="search-query"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                      />
                  </div>
              </div>
              <div>
                  <Label>Source</Label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        {allSources.map(source => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                    </SelectContent>
                  </Select>
              </div>
              <div>
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {statusesForFilter.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
              </div>
              <div>
                  <Label>From</Label>
                  <DatePicker date={fromDate} setDate={setFromDate} placeholder="Pick a start date" />
              </div>
              <div>
                  <div className="flex justify-between items-center">
                    <Label>To</Label>
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                        <X className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  </div>
                  <DatePicker date={toDate} setDate={setToDate} placeholder="Pick an end date" />
              </div>
          </CardContent>
       </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your To-Do List</CardTitle>
          <CardDescription>All tasks assigned to you across tickets, projects, and Kanban boards.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && tasks.length === 0 ? (
             <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
             </div>
          ) : error ? (
            <p className="text-destructive text-center py-8">{error}</p>
          ) : filteredTasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
                {tasks.length > 0 ? 'No tasks match the current filters.' : 'You have no assigned tasks. Great job!'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title / ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map(task => {
                  const availableStatuses = getStatusesForSource(task.source);
                  return (
                    <TableRow key={`${task.source}-${task.id}`}>
                      <TableCell className="font-medium">
                          {task.title}
                      </TableCell>
                      <TableCell>
                        <SourceBadge source={task.source} />
                      </TableCell>
                      <TableCell>
                        <Select value={task.status} onValueChange={(newStatus) => handleStatusChange(task, newStatus)}>
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableStatuses.map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
