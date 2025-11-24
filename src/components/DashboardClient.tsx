

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseISO, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { Search, Ticket, CheckCircle2, LoaderCircle, X, Calendar as CalendarIcon, Circle, Eye, Archive, ThumbsUp, Clock, Hourglass } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface DashboardClientProps {
    tickets: string[][];
    headers: string[];
    teams: string[];
    statuses: string[];
    workTypes: string[];
}

const ClientDate = ({ dateString }: { dateString: string }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted || !dateString) {
        return <>{dateString}</>;
    }
    
    try {
        const date = new Date(dateString);
        return <>{format(date, 'yyyy-MM-dd HH:mm')}</>
    } catch(e) {
        return <>{dateString}</>;
    }
}

const StatusIndicator = ({ status }: { status: string }) => {
    const statusMap: Record<string, { label: string; color: string; icon: JSX.Element }> = {
        'In Review': { label: 'In Review', color: 'bg-yellow-500', icon: <Circle className="h-2.5 w-2.5 text-yellow-500 fill-current" /> },
        'In Progress': { label: 'In Progress', color: 'bg-blue-500', icon: <Circle className="h-2.5 w-2.5 text-blue-500 fill-current" /> },
        'Prioritized': { label: 'Prioritized', color: 'bg-orange-500', icon: <Circle className="h-2.5 w-2.5 text-orange-500 fill-current" /> },
        'On Hold': { label: 'On Hold', color: 'bg-gray-500', icon: <Circle className="h-2.5 w-2.5 text-gray-500 fill-current" /> },
        'Delivered': { label: 'Delivered', color: 'bg-purple-500', icon: <Circle className="h-2.5 w-2.5 text-purple-500 fill-current" /> },
        'Completed': { label: 'Completed', color: 'bg-green-500', icon: <Circle className="h-2.5 w-2.5 text-green-500 fill-current" /> },
        'Open': { label: 'In Review', color: 'bg-yellow-500', icon: <Circle className="h-2.5 w-2.5 text-yellow-500 fill-current" /> },
        'Done': { label: 'Completed', color: 'bg-green-500', icon: <Circle className="h-2.5 w-2.5 text-green-500 fill-current" /> },
    };

    const currentStatusKey = status === 'Open' ? 'In Review' : status;
    const currentStatus = statusMap[currentStatusKey] || { label: status, color: 'bg-gray-500', icon: <Circle className="h-2.5 w-2.5 text-gray-500 fill-current" /> };

    return (
        <Badge variant="outline" className="flex items-center gap-2 capitalize">
           {currentStatus.icon}
           <span>{currentStatus.label}</span>
        </Badge>
    );
};

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


export function DashboardClient({ tickets, headers, teams, statuses, workTypes }: DashboardClientProps) {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All');
  const [workTypeFilter, setWorkTypeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTicketDetails, setSelectedTicketDetails] = useState<{ details: Record<string, string>, status: string, ticketId: string } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const visibleHeaders = useMemo(() => {
    return headers.filter(h => VISIBLE_COLUMNS.includes(h));
  }, [headers]);


  const createdDateIndex = headers.indexOf('Created Date');
  const statusIndex = headers.indexOf('Status');
  const teamIndex = headers.indexOf('Team');
  const ticketIdIndex = headers.indexOf('Ticket ID');
  const workTypeIndex = headers.indexOf('Work Type');


  const filteredTickets = useMemo(() => tickets.filter(row => {
    // Search query filter
    const matchesSearch = (() => {
        if (!searchQuery) return true;
        if (ticketIdIndex === -1) return true;
        return row[ticketIdIndex]?.toLowerCase().includes(searchQuery.toLowerCase());
    })();

    // Date filter
    const isWithinDate = (() => {
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
    })();
    
    // Status filter
    const hasStatus = statusFilter === 'All' || (statusIndex !== -1 && (row[statusIndex] === statusFilter || (statusFilter === 'In Review' && row[statusIndex] === 'Open')));

    // Team filter
    const hasTeam = teamFilter === 'All' || (teamIndex !== -1 && (row[teamIndex] || '').split(', ').includes(teamFilter));
    
    // Work Type filter
    const hasWorkType = workTypeFilter === 'All' || (workTypeIndex !== -1 && row[workTypeIndex] === workTypeFilter);

    return matchesSearch && isWithinDate && hasStatus && hasTeam && hasWorkType;
  }), [tickets, searchQuery, fromDate, toDate, statusFilter, teamFilter, workTypeFilter, ticketIdIndex, headers, createdDateIndex, statusIndex, teamIndex, workTypeIndex]);

  const stats = useMemo(() => {
    const statusCounts = filteredTickets.reduce((acc, ticket) => {
        const status = statusIndex !== -1 ? ticket[statusIndex] : '';
        if (status === 'In Review' || status === 'Open') acc.inReview++;
        if (status === 'In Progress') acc.inProgress++;
        if (status === 'Prioritized') acc.prioritized++;
        if (status === 'On Hold') acc.onHold++;
        if (status === 'Delivered') acc.delivered++;
        if (status === 'Completed' || status === 'Done') acc.completed++;
        return acc;
    }, { 
        inReview: 0,
        inProgress: 0,
        prioritized: 0,
        onHold: 0,
        delivered: 0,
        completed: 0,
    });
    return { ...statusCounts, total: filteredTickets.length };
  }, [filteredTickets, statusIndex]);
  
  const handleClearFilters = () => {
    setSearchQuery('');
    setFromDate(undefined);
    setToDate(undefined);
    setStatusFilter('All');
    setTeamFilter('All');
    setWorkTypeFilter('All');
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
    setIsDialogOpen(true);
  }

  const isAnyFilterActive = searchQuery || fromDate || toDate || statusFilter !== 'All' || teamFilter !== 'All' || workTypeFilter !== 'All';

  const totalTicketsCard = { title: 'Total Tickets', value: stats.total.toString(), icon: <Ticket className="h-8 w-8 text-primary" />, color: "text-primary" };
  const otherStatsCards = [
    { title: 'In Review', value: stats.inReview.toString(), icon: <Eye className="h-8 w-8 text-yellow-500" />, color: "text-yellow-500" },
    { title: 'In Progress', value: stats.inProgress.toString(), icon: <LoaderCircle className="h-8 w-8 text-blue-500" />, color: "text-blue-500" },
    { title: 'Prioritized', value: stats.prioritized.toString(), icon: <Archive className="h-8 w-8 text-orange-500" />, color: "text-orange-500" },
    { title: 'On Hold', value: stats.onHold.toString(), icon: <Hourglass className="h-8 w-8 text-gray-500" />, color: "text-gray-500" },
    { title: 'Delivered', value: stats.delivered.toString(), icon: <ThumbsUp className="h-8 w-8 text-purple-500" />, color: "text-purple-500" },
    { title: 'Completed', value: stats.completed.toString(), icon: <CheckCircle2 className="h-8 w-8 text-green-500" />, color: "text-green-500" },
  ];
  
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
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

      <div className="mb-8 flex justify-center">
        <div className="w-full max-w-sm">
          <Card className="rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6">
              <div className="space-y-1">
                <CardTitle className="text-base font-medium text-muted-foreground">{totalTicketsCard.title}</CardTitle>
                <div className={`text-4xl font-bold transition-colors duration-300 ${totalTicketsCard.color}`}>
                  {totalTicketsCard.value}
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                {totalTicketsCard.icon}
              </div>
            </CardHeader>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6 mb-8">
        {otherStatsCards.map((stat) => (
            <Card key={stat.title} className="rounded-xl transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6">
                    <div className="space-y-1">
                        <CardTitle className="text-base font-medium text-muted-foreground">{stat.title}</CardTitle>
                        <div className={`text-4xl font-bold transition-colors duration-300 ${stat.color}`}>
                            {stat.value}
                        </div>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-lg">
                        {stat.icon}
                    </div>
                </CardHeader>
            </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
          <CardDescription>Filter and view all submitted tickets.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-end">
              <div className="relative">
                <Label htmlFor="search-id">Search by ID</Label>
                <Search className="absolute left-3 top-9 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-id"
                  placeholder="Search by Ticket ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
               <div>
                  <Label htmlFor="team-filter">Team</Label>
                   <Select value={teamFilter} onValueChange={setTeamFilter}>
                      <SelectTrigger id="team-filter">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          {teams.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <div>
                  <Label htmlFor="work-type-filter">Work Type</Label>
                   <Select value={workTypeFilter} onValueChange={setWorkTypeFilter}>
                      <SelectTrigger id="work-type-filter">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          {workTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
               <div>
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger id="status-filter">
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
               <div>
                <Label htmlFor="from-date">From Date</Label>
                <DatePicker date={fromDate} setDate={setFromDate} placeholder="Pick a start date" />
              </div>
              <div>
                <Label htmlFor="to-date">To Date</Label>
                <DatePicker date={toDate} setDate={setToDate} placeholder="Pick an end date" />
              </div>
              {isAnyFilterActive && (
                  <Button variant="ghost" onClick={handleClearFilters} className="justify-self-start">
                      <X className="mr-2 h-4 w-4" />
                      Clear Filters
                  </Button>
              )}
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                        {visibleHeaders.map((header) => (
                          <TableHead key={header}>{header.replace('*', '')}</TableHead>
                        ))}
                        {filteredTickets.length > 0 && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.length > 0 ? (
                      filteredTickets.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {visibleHeaders.map((header) => {
                             const cellIndex = headers.indexOf(header);
                             const cell = row[cellIndex];
                             if (header === 'Created Date') {
                                 return <TableCell key={header}><ClientDate dateString={cell} /></TableCell>
                             }
                             if (header === 'Status') {
                                return <TableCell key={header}><StatusIndicator status={cell} /></TableCell>
                             }
                              if (header === 'Work Type') {
                                return <TableCell key={header}><WorkTypeIndicator workType={cell} /></TableCell>
                             }
                             return <TableCell key={header}>{cell}</TableCell>
                          })}
                          <TableCell>
                               <Button variant="outline" size="sm" onClick={() => handleViewDetails(row)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                          <TableCell colSpan={visibleHeaders.length + 1} className="h-24 text-center">
                              No tickets found.
                          </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
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
        </CardContent>
      </Card>
    </>
  );
}
