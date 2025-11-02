
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAllTickets, createProjectFromTicket, updateTicketStatus } from '@/app/actions';
import { Loader2, FolderPlus, Calendar as CalendarIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseISO, isWithinInterval, startOfDay, endOfDay, format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';


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


export default function AllTicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<{rowIndex: number, values: string[]} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const { toast } = useToast();

  const fetchTickets = async () => {
    setIsLoading(true);
    setError('');
    try {
      const sheetData = await getAllTickets();
      if (sheetData && sheetData.values && sheetData.values.length > 0) {
        setHeaders(sheetData.values[0]);
        setTickets(sheetData.values.slice(1).reverse());
      } else {
        setHeaders([]);
        setTickets([]);
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

  const handleCreateProject = async () => {
    if (!selectedTicket) return;
    setIsSubmitting(true);
    
    const originalIndex = tickets.length - 1 - selectedTicket.rowIndex;
    const result = await createProjectFromTicket({ ...selectedTicket, rowIndex: originalIndex + 1 });

    if (result.success) {
      toast({
        title: 'Project Created!',
        description: 'The ticket has been converted to a project.',
      });
      setSelectedTicket(null);
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
  
  const canManage = user?.role === 'admin';
  const statusIndex = headers.indexOf('Status');
  const createdDateIndex = headers.indexOf('Created Date');

  const filteredTickets = tickets.filter(row => {
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
  });

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
        <h1 className="text-3xl font-bold">All Submitted Tickets</h1>
        {selectedTicket && canManage && (
            <Button onClick={handleCreateProject} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
                Create Project
            </Button>
        )}
      </div>
       <Card className="mb-6">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[50px]">Select</TableHead>
                    {headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredTickets.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                        <TableCell>
                            <Checkbox 
                                checked={selectedTicket?.rowIndex === rowIndex}
                                onCheckedChange={() => handleSelectTicket(rowIndex, row)}
                                disabled={!canManage}
                            />
                        </TableCell>
                        {row.map((cell, cellIndex) => {
                             if (cellIndex === statusIndex) {
                                return (
                                    <TableCell key={cellIndex}>
                                        <Select
                                            defaultValue={cell}
                                            onValueChange={(newStatus) => handleStatusChange(rowIndex, newStatus)}
                                            disabled={!canManage}
                                        >
                                            <SelectTrigger className="w-[150px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Open">Pending</SelectItem>
                                                <SelectItem value="In Progress">In Progress</SelectItem>
                                                <SelectItem value="Done">Done</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                )
                             }
                             if (cellIndex === createdDateIndex) {
                                return <TableCell key={cellIndex}><ClientDate dateString={cell} /></TableCell>
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
