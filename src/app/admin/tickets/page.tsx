

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAllTickets, createProjectFromTicket, updateTicketStatus, getProjects } from '@/app/actions';
import { Loader2, FolderPlus, Calendar as CalendarIcon, Eye, Circle, Search, CheckCircle2, Archive, ThumbsUp, Clock, Hourglass, LoaderCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseISO, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const ClientDate = ({ dateString }: { dateString: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted || !dateString) {
        return <>{dateString}</>;
    }
    
    try {
        const date = new Date(dateString);
        // This will format it in the user's local timezone from the ISO string
        return <>{format(date, 'yyyy-MM-dd HH:mm')}</>
    } catch(e) {
        // Fallback for invalid date strings
        return <>{dateString}</>;
    }
}

const WorkTypeIndicator = ({ workType }: { workType: string }) => {
    const typeMap: Record<string, { label: string; color: string; }> = {
        'Urgent': { label: 'Urgent', color: 'text-red-500 fill-red-500' },
        'Regular': { label: 'Regular', color: 'text-green-500 fill-green-500' },
    };

    const currentType = typeMap[workType] || { label: workType, color: 'text-gray-500 fill-gray-500' };

    return (
        <Badge variant="outline" className="flex items-center gap-2 capitalize">
           <Circle className={`h-2.5 w-2.5 ${currentType.color}`} />
           <span>{currentType.label}</span>
        </Badge>
    );
};

const VISIBLE_COLUMNS = [
  'Ticket ID',
  'Created Date',
  'Status',
  'Team',
  'Work Type',
  'Product/Course/Requisition Name',
  'Your Email*',
];

const statusMessages: Record<string, { message: string, icon: React.ReactNode, color: string }> = {
    'In Review': { message: "Your ticket is in review. We will process it shortly.", icon: <Eye className="h-5 w-5" />, color: "text-yellow-500" },
    'In Progress': { message: "Work on your ticket has started. You will be notified of any updates.", icon: <LoaderCircle className="h-5 w-5" />, color: "text-blue-500" },
    'Prioritized': { message: "Your ticket has been prioritized and will be addressed soon.", icon: <Archive className="h-5 w-5" />, color: "text-orange-500" },
    'On Hold': { message: "Your ticket is temporarily on hold. We will resume work as soon as possible.", icon: <Hourglass className="h-5 w-5" />, color: "text-gray-500" },
    'Delivered': { message: "The work for your ticket has been delivered.", icon: <ThumbsUp className="h-5 w-5" />, color: "text-purple-500" },
    'Completed': { message: "Your ticket has been resolved and completed.", icon: <CheckCircle2 className="h-5 w-5" />, color: "text-green-500" },
};

const StatusHeader = ({ status }: { status: string }) => {
    const currentStatus = status === 'Open' ? 'In Review' : status;
    const details = statusMessages[currentStatus] || { message: `Current status: ${currentStatus}`, icon: <Circle className="h-5 w-5" />, color: 'text-muted-foreground' };
    return (
        <div className="p-4 rounded-lg border bg-muted/50 mb-4">
            <div className="flex items-center gap-3">
                <div className={details.color}>{details.icon}</div>
                <div>
                    <p className={`font-semibold ${details.color}`}>{currentStatus}</p>
                    <p className="text-sm text-muted-foreground">{details.message}</p>
                </div>
            </div>
        </div>
    );
};


export default function AllTicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [existingProjectTicketIds, setExistingProjectTicketIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<{rowIndex: number, values: string[]} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [ticketIdFilter, setTicketIdFilter] = useState('');
  const [selectedTicketDetails, setSelectedTicketDetails] = useState<{ details: Record<string, string>, status: string, ticketId: string } | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');


  const { toast } = useToast();

  const fetchTickets = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [ticketData, projectData] = await Promise.all([getAllTickets(), getProjects()]);

      if (ticketData && ticketData.values && ticketData.values.length > 0) {
        setHeaders(ticketData.values[0]);
        setTickets(ticketData.values.slice(1).reverse());
      } else {
        setHeaders([]);
        setTickets([]);
      }
      
      if (projectData && projectData.values && projectData.values.length > 0) {
        const projectHeaders = projectData.values[0];
        const ticketIdColIndex = projectHeaders.indexOf('Ticket ID');
        if (ticketIdColIndex !== -1) {
            const ids = new Set(projectData.values.slice(1).map(p => p[ticketIdColIndex]).filter(Boolean));
            setExistingProjectTicketIds(ids);
        }
      }

    } catch (err) {
      console.error(err);
      setError("Failed to load tickets from Google Sheet.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);
  
  const handleSelectTicket = (rowIndex: number, values: string[]) => {
     if (selectedTicket?.rowIndex === rowIndex) {
        setSelectedTicket(null);
     } else {
        setSelectedTicket({ rowIndex, values });
     }
  }

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newProjectTitle) return;
    setIsSubmitting(true);
    
    const originalIndex = tickets.length - 1 - selectedTicket.rowIndex;
    const result = await createProjectFromTicket({ ...selectedTicket, rowIndex: originalIndex + 1 }, newProjectTitle);

    if (result.success) {
      toast({
        title: 'Project Created!',
        description: 'The ticket has been converted to a project.',
      });
      setSelectedTicket(null);
      setNewProjectTitle('');
      setIsCreateProjectDialogOpen(false);
      await fetchTickets(); 
    } else {
       toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'Failed to create project.',
      });
    }
    setIsSubmitting(false);
  }

  const handleStatusChange = async (rowIndex: number, newStatus: string) => {
    const originalIndex = tickets.length - 1 - rowIndex;
    const sheetRowIndex = originalIndex + 1;
    const result = await updateTicketStatus(sheetRowIndex, newStatus);
    if (result.success) {
        toast({ title: "Status Updated", description: "Ticket status has been saved." });
        const newTickets = [...tickets];
        const statusIndex = headers.indexOf("Status");
        if (statusIndex !== -1) {
            newTickets[rowIndex][statusIndex] = newStatus;
            setTickets(newTickets);
        }
    } else {
        toast({ variant: "destructive", title: "Error", description: result.error || "Failed to update status." });
    }
  };
  
    const handleViewDetails = (row: string[]) => {
        const details = headers.reduce((acc, header, index) => {
            if (!VISIBLE_COLUMNS.includes(header)) {
                acc[header.replace(/\s*\(.*?\)/g, '').trim()] = row[index] || 'N/A';
            }
            return acc;
        }, {} as Record<string, string>);
        
        const status = row[statusIndex] || 'N/A';
        const ticketId = row[ticketIdIndex] || 'N/A';

        setSelectedTicketDetails({ details, status, ticketId });
        setIsDetailsDialogOpen(true);
    };

  const isLoggedIn = !!user;
  const canManageProjects = user?.role === 'admin';
  const statusIndex = headers.indexOf('Status');
  const workTypeIndex = headers.indexOf('Work Type');
  const createdDateIndex = headers.indexOf('Created Date');
  const ticketIdIndex = headers.indexOf('Ticket ID');


  const filteredTickets = tickets.filter(row => {
    if (ticketIdIndex !== -1 && ticketIdFilter) {
        if (!row[ticketIdIndex]?.toLowerCase().includes(ticketIdFilter.toLowerCase())) {
            return false;
        }
    }
    if (!fromDate && !toDate) return true;
    if (createdDateIndex === -1) return true; 

    try {
        const dateString = row[createdDateIndex];
        const ticketDate = new Date(dateString.replace(' ', 'T') + 'Z');
        
        const start = fromDate ? startOfDay(fromDate) : new Date(0);
        const end = toDate ? endOfDay(toDate) : new Date();
        return isWithinInterval(ticketDate, { start, end });
    } catch {
        return false;
    }
  });
  
  const visibleHeaders = headers.filter(h => VISIBLE_COLUMNS.includes(h) || h === 'Status' || h === 'Created Date');


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
    <>
      <div className="container mx-auto py-8 px-4 md:px-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">All Submitted Tickets</h1>
          {selectedTicket && canManageProjects && (
              <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <FolderPlus className="mr-2 h-4 w-4" />
                        Create Project
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                        <DialogDescription>
                            Enter a title for the new project. This will be created from ticket {selectedTicket.values[ticketIdIndex]}.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateProject}>
                        <div className="py-4">
                            <Label htmlFor="project-title">Project Title</Label>
                            <Input 
                                id="project-title"
                                value={newProjectTitle}
                                onChange={(e) => setNewProjectTitle(e.target.value)}
                                placeholder="Enter a descriptive project title"
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsCreateProjectDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Project'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
              </Dialog>
          )}
        </div>
         <Card className="mb-6">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                  <Label htmlFor="search-id">Search by Ticket ID</Label>
                  <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                          id="search-id"
                          placeholder="TICKET-..."
                          value={ticketIdFilter}
                          onChange={(e) => setTicketIdFilter(e.target.value)}
                          className="pl-10"
                      />
                  </div>
              </div>
              <div>
                  <Label htmlFor="from-date">From</Label>
                  <DatePicker date={fromDate} setDate={setFromDate} placeholder="Pick a start date" />
              </div>
              <div>
                  <Label htmlFor="to-date">To</Label>
                  <DatePicker date={toDate} setDate={setToDate} placeholder="Pick an end date" />
              </div>
          </CardContent>
         </Card>
        <Card>
            <CardHeader>
              <CardTitle>Tickets from Google Sheet</CardTitle>
              <CardDescription>
                  This is a live view of all the tickets submitted through the form, from the 'Tickets' sheet. Select one to create a project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                  <div className="flex justify-center items-center py-8"><Loader2 className="mr-2 h-8 w-8 animate-spin" /> Loading tickets...</div>
              ) : error ? (
                  <p className="text-destructive text-center py-8">{error}</p>
              ) : (
               <div className="overflow-x-auto">
                <TooltipProvider>
                  <Table>
                  <TableHeader>
                      <TableRow>
                          <TableHead className="w-[50px]">Select</TableHead>
                          {visibleHeaders.map((header) => (
                              <TableHead key={header}>{header.replace('*', '')}</TableHead>
                          ))}
                          <TableHead>Actions</TableHead>
                      </TableRow>
                  </TableHeader>
                  <TableBody>
                      {filteredTickets.map((row, rowIndex) => {
                          const ticketId = ticketIdIndex !== -1 ? row[ticketIdIndex] : '';
                          const isProjectCreated = ticketId ? existingProjectTicketIds.has(ticketId) : false;

                          return (
                            <TableRow key={rowIndex}>
                                <TableCell>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            {/* The div is necessary for the tooltip to work on a disabled element */}
                                            <div> 
                                                <Checkbox 
                                                    checked={selectedTicket?.rowIndex === tickets.indexOf(row)}
                                                    onCheckedChange={() => handleSelectTicket(tickets.indexOf(row), row)}
                                                    disabled={!canManageProjects || isProjectCreated}
                                                />
                                            </div>
                                        </TooltipTrigger>
                                        {isProjectCreated && (
                                            <TooltipContent>
                                                <p>A project has already been created for this ticket.</p>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </TableCell>
                                {visibleHeaders.map((header) => {
                                      const cellIndex = headers.indexOf(header);
                                      const cell = row[cellIndex];

                                      if (cellIndex === statusIndex) {
                                        return (
                                            <TableCell key={header}>
                                                <Select
                                                    defaultValue={cell === 'Open' ? 'In Review' : cell}
                                                    onValueChange={(newStatus) => handleStatusChange(tickets.indexOf(row), newStatus)}
                                                    disabled={!isLoggedIn}
                                                >
                                                    <SelectTrigger className="w-[150px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="In Review">In Review</SelectItem>
                                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                                        <SelectItem value="Prioritized">Prioritized</SelectItem>
                                                        <SelectItem value="On Hold">On Hold</SelectItem>
                                                        <SelectItem value="Delivered">Delivered</SelectItem>
                                                        <SelectItem value="Completed">Completed</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        )
                                     }
                                     if (cellIndex === workTypeIndex) {
                                        return <TableCell key={header}><WorkTypeIndicator workType={cell} /></TableCell>
                                     }
                                     if (cellIndex === createdDateIndex) {
                                        return <TableCell key={header}><ClientDate dateString={cell} /></TableCell>
                                     }
                                    return <TableCell key={header}>{cell === 'Open' ? 'In Review' : cell}</TableCell>
                                })}
                                <TableCell>
                                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(row)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </Button>
                                </TableCell>
                            </TableRow>
                          );
                      })}
                  </TableBody>
                  </Table>
                </TooltipProvider>
               </div>
              )}
            </CardContent>
          </Card>
      </div>
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
          <DialogContent className="max-w-2xl">
             <DialogHeader>
                <DialogTitle>Ticket Details</DialogTitle>
                <DialogDescription>Full details for ticket {selectedTicketDetails?.ticketId}</DialogDescription>
             </DialogHeader>
             {selectedTicketDetails && (
                <div className="mt-4">
                   <StatusHeader status={selectedTicketDetails.status} />
                   <div className="max-h-[50vh] overflow-y-auto pr-4">
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                       {Object.entries(selectedTicketDetails.details).map(([key, value]) => (
                            <div key={key} className="border-b pb-2">
                                <dt className="text-sm font-medium text-muted-foreground">{key}</dt>
                                <dd className="mt-1 text-sm text-foreground">{value}</dd>
                            </div>
                       ))}
                    </dl>
                   </div>
                </div>
             )}
          </DialogContent>
      </Dialog>
    </>
  );
}



    
