

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { parseISO, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { Search, Ticket, CheckCircle2, LoaderCircle, X, Calendar as CalendarIcon, Circle } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

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
        return <>{format(parseISO(dateString), 'yyyy-MM-dd HH:mm')}</>
    } catch(e) {
        return <>{dateString}</>;
    }
}

const StatusIndicator = ({ status }: { status: string }) => {
    const statusMap: Record<string, { label: string; color: string; icon: JSX.Element }> = {
        'Open': { label: 'Pending', color: 'bg-yellow-500', icon: <Circle className="h-2.5 w-2.5 text-yellow-500 fill-current" /> },
        'In Progress': { label: 'In Progress', color: 'bg-blue-500', icon: <Circle className="h-2.5 w-2.5 text-blue-500 fill-current" /> },
        'Done': { label: 'Done', color: 'bg-green-500', icon: <Circle className="h-2.5 w-2.5 text-green-500 fill-current" /> },
    };

    const currentStatus = statusMap[status] || { label: status, color: 'bg-gray-500', icon: <Circle className="h-2.5 w-2.5 text-gray-500 fill-current" /> };

    return (
        <Badge variant="outline" className="flex items-center gap-2 capitalize">
           {currentStatus.icon}
           <span>{currentStatus.label}</span>
        </Badge>
    );
};


export function DashboardClient({ tickets, headers: initialHeaders, teams, statuses, workTypes }: DashboardClientProps) {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All');
  const [workTypeFilter, setWorkTypeFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const headers = useMemo(() => {
    const newHeaders = [...initialHeaders];
    const teamQuestionHeader = 'which team you want to select*';
    const teamIndex = newHeaders.indexOf('Team');
    const teamQuestionIndex = newHeaders.findIndex(h => h.toLowerCase().startsWith('the requisition is for which team'));

    // If 'Team' column doesn't exist, we might need to rename the question column
    if (teamIndex === -1 && teamQuestionIndex !== -1) {
      newHeaders[teamQuestionIndex] = 'Team';
    } else if (teamIndex === -1 && teamQuestionIndex === -1) {
       newHeaders.push('Team');
    }
    
    return newHeaders;
  }, [initialHeaders]);

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
            const ticketDate = parseISO(row[createdDateIndex]);
            const start = fromDate ? startOfDay(fromDate) : new Date(0);
            const end = toDate ? endOfDay(toDate) : new Date();
            return isWithinInterval(ticketDate, { start, end });
        } catch {
            return false;
        }
    })();
    
    // Status filter
    const hasStatus = statusFilter === 'All' || (statusIndex !== -1 && row[statusIndex] === statusFilter);

    // Team filter
    const hasTeam = teamFilter === 'All' || (teamIndex !== -1 && (row[teamIndex] || '').split(', ').includes(teamFilter));
    
    // Work Type filter
    const hasWorkType = workTypeFilter === 'All' || (workTypeIndex !== -1 && row[workTypeIndex] === workTypeFilter);

    return matchesSearch && isWithinDate && hasStatus && hasTeam && hasWorkType;
  }), [tickets, searchQuery, fromDate, toDate, statusFilter, teamFilter, workTypeFilter, ticketIdIndex, headers, createdDateIndex, statusIndex, teamIndex, workTypeIndex]);

  const stats = useMemo(() => {
    return filteredTickets.reduce((acc, ticket) => {
        const status = statusIndex !== -1 ? ticket[statusIndex] : '';
        if (status === 'Done') {
            acc.solved++;
        } else if (status === 'In Progress') {
            acc.inProgress++;
        } else if (status === 'Open') {
            acc.pending++;
        }
        return acc;
    }, { total: filteredTickets.length, solved: 0, inProgress: 0, pending: 0 });
  }, [filteredTickets, statusIndex]);
  
  const handleClearFilters = () => {
    setSearchQuery('');
    setFromDate(undefined);
    setToDate(undefined);
    setStatusFilter('All');
    setTeamFilter('All');
    setWorkTypeFilter('All');
  };

  const isAnyFilterActive = searchQuery || fromDate || toDate || statusFilter !== 'All' || teamFilter !== 'All' || workTypeFilter !== 'All';

  const statsCards = [
    { title: 'Total Tickets', value: stats.total.toString(), icon: <Ticket className="h-8 w-8 text-primary" />, color: "text-primary" },
    { title: 'Pending', value: stats.pending.toString(), icon: <LoaderCircle className="h-8 w-8 text-yellow-500" />, color: "text-yellow-500" },
    { title: 'In Progress', value: stats.inProgress.toString(), icon: <LoaderCircle className="h-8 w-8 text-blue-500" />, color: "text-blue-500" },
    { title: 'Tickets Solved', value: stats.solved.toString(), icon: <CheckCircle2 className="h-8 w-8 text-green-500" />, color: "text-green-500" },
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsCards.map((stat) => (
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

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTickets.length > 0 ? (
                  filteredTickets.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => {
                         if (cellIndex === createdDateIndex) {
                             return <TableCell key={cellIndex}><ClientDate dateString={cell} /></TableCell>
                         }
                         if (cellIndex === statusIndex) {
                            return <TableCell key={cellIndex}><StatusIndicator status={cell} /></TableCell>
                         }
                         return <TableCell key={cellIndex}>{cell}</TableCell>
                      })}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                      <TableCell colSpan={headers.length} className="h-24 text-center">
                          No tickets found.
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
